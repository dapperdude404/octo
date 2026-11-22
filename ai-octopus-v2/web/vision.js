import {loadVendor, vendorUrl} from './vendor-loader.js';

const profileKey = 'octo_local_face_profiles_v1';
const threshold = 0.53;
const slots = ['reference', 'candidate'];
let models;

function readProfiles() {
  try {
    const saved = JSON.parse(localStorage.getItem(profileKey) || '[]');
    if (!Array.isArray(saved)) return [];
    return saved.filter(profile => typeof profile?.id === 'string'
      && typeof profile.name === 'string'
      && Array.isArray(profile.encoding)
      && profile.encoding.length === 128
      && profile.encoding.every(Number.isFinite)).slice(0, 12);
  } catch {
    return [];
  }
}

async function getModels() {
  if (!models) {
    models = (async () => {
      const api = await loadVendor('face-api.js', 'faceapi');
      if (api.tf?.ready) {
        try { await api.tf.ready(); }
        catch { await api.tf.setBackend('cpu'); }
      }
      const directory = vendorUrl('face-models').replace(/\/$/, '');
      await Promise.all([
        api.nets.tinyFaceDetector.loadFromUri(directory),
        api.nets.faceLandmark68TinyNet.loadFromUri(directory),
        api.nets.faceRecognitionNet.loadFromUri(directory)
      ]);
      return api;
    })();
    models.catch(() => { models = null; });
  }
  return models;
}

function paint(canvas, source, width, height) {
  if (!width || !height) throw Error('This photo did not have readable dimensions.');
  const factor = Math.min(1, 900 / Math.max(width, height));
  canvas.width = Math.round(width * factor);
  canvas.height = Math.round(height * factor);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
}

async function decodePhoto(file) {
  if (file.size > 12 * 1024 * 1024) throw Error('Choose a photo of 12 MB or less.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw Error('The image has no dimensions.');
    return image;
  } catch {
    throw Error('Could not read this photo. Choose a supported photo such as PNG, JPEG, or WebP.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function embedding(canvas) {
  const api = await getModels();
  const matches = await api.detectAllFaces(canvas, new api.TinyFaceDetectorOptions({
    inputSize: 416,
    scoreThreshold: .48
  })).withFaceLandmarks(true).withFaceDescriptors();
  if (!matches.length) throw Error('No face detected. Try one well-lit, front-facing photo.');
  if (matches.length !== 1) throw Error('More than one face was detected. Choose a photo with one person.');
  return Array.from(matches[0].descriptor);
}

function faceDistance(first, second) {
  return Math.sqrt(first.reduce((sum, value, i) => sum + (value - second[i]) ** 2, 0));
}

export function initVision() {
  const $ = id => document.getElementById(id);
  const status = $('vision-status');
  const result = $('vision-result');
  const profileSelect = $('vision-target');
  const profileList = $('vision-profiles');
  const permission = $('vision-permission');
  const save = $('vision-enroll');
  const match = $('vision-match');
  const camera = $('vision-video');
  let profiles = readProfiles();
  let working = false;
  let stream;
  let cameraSlot;
  let cameraTicket = 0;
  const photos = Object.fromEntries(slots.map(slot => [slot, {ready: false, version: 0}]));

  function saveProfiles(next) {
    localStorage.setItem(profileKey, JSON.stringify(next));
    profiles = next;
  }

  function refresh() {
    $('vision-profile-count').textContent = profiles.length + (profiles.length === 1 ? ' profile' : ' profiles');
    const selected = profileSelect.value;
    profileSelect.replaceChildren(new Option('Closest saved profile', ''), ...profiles.map(profile =>
      new Option(profile.name, profile.id)
    ));
    if (profiles.some(profile => profile.id === selected)) profileSelect.value = selected;
    const rows = profiles.map(profile => {
      const row = document.createElement('li');
      const name = document.createElement('strong');
      name.textContent = profile.name;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'subtle-btn';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', 'Remove ' + profile.name);
      remove.onclick = () => {
        if (working) return;
        try {
          saveProfiles(profiles.filter(item => item.id !== profile.id));
          result.hidden = true;
          status.textContent = 'Local profile removed.';
          refresh();
        } catch {
          status.textContent = 'Browser storage is unavailable.';
        }
      };
      row.append(name, remove);
      return row;
    });
    profileList.replaceChildren(...rows);
    $('vision-empty').hidden = rows.length > 0;
    save.disabled = working || !photos.reference.ready;
    match.disabled = working || !photos.candidate.ready || !profiles.length;
  }

  function showPhoto(slot, image, width, height) {
    const view = $('vision-' + slot + '-photo');
    paint(view, image, width, height);
    view.hidden = false;
    $('vision-' + slot + '-empty').hidden = true;
    photos[slot].ready = true;
    result.hidden = true;
    refresh();
  }

  function stopCamera() {
    cameraTicket++;
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    camera.srcObject = null;
    $('vision-camera').hidden = true;
  }

  async function openCamera(slot) {
    if (!permission.checked) {
      status.textContent = 'Confirm permission before using the camera.';
      permission.focus();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      status.textContent = 'Camera access is unavailable here. Choose a photo file.';
      return;
    }
    stopCamera();
    const ticket = cameraTicket;
    try {
      const feed = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'user'}, audio: false});
      if (ticket !== cameraTicket) {
        feed.getTracks().forEach(track => track.stop());
        return;
      }
      stream = feed;
      cameraSlot = slot;
      camera.srcObject = stream;
      $('vision-camera').hidden = false;
      await camera.play();
      status.textContent = 'Camera ready. Capture a single front-facing photo.';
    } catch {
      if (ticket !== cameraTicket) return;
      stopCamera();
      status.textContent = 'Camera permission is unavailable. Choose a photo file instead.';
    }
  }

  for (const slot of slots) {
    const input = $('vision-' + slot);
    input.onchange = async () => {
      const file = input.files[0];
      input.value = '';
      if (!file) return;
      const ticket = ++photos[slot].version;
      try {
        const image = await decodePhoto(file);
        if (ticket !== photos[slot].version) return;
        showPhoto(slot, image, image.naturalWidth, image.naturalHeight);
        status.textContent = 'Photo ready for local analysis.';
      } catch (error) {
        if (ticket === photos[slot].version) status.textContent = error.message;
      }
    };
  }
  document.querySelectorAll('[data-camera-for]').forEach(button => {
    button.onclick = () => openCamera(button.dataset.cameraFor);
  });
  $('vision-camera-close').onclick = stopCamera;
  $('vision-camera-capture').onclick = () => {
    if (!camera.videoWidth) { status.textContent = 'Wait for the camera to finish starting.'; return; }
    photos[cameraSlot].version++;
    showPhoto(cameraSlot, camera, camera.videoWidth, camera.videoHeight);
    stopCamera();
    status.textContent = 'Photo captured for local analysis.';
  };

  async function analyze(slot, useEncoding) {
    if (working) return;
    if (!permission.checked) {
      status.textContent = 'Confirm that you have permission to use these photos.';
      permission.focus();
      return;
    }
    const ticket = photos[slot].version;
    working = true;
    result.hidden = true;
    refresh();
    status.textContent = 'Analyzing on this device…';
    try {
      const encoding = await embedding($('vision-' + slot + '-photo'));
      if (ticket === photos[slot].version && permission.checked) {
        useEncoding(encoding);
      } else {
        status.textContent = 'The photo or permission changed. Run the check again.';
      }
    } catch (error) {
      status.textContent = error.message || 'The local model could not analyze this photo.';
    } finally {
      working = false;
      refresh();
    }
  }

  save.onclick = () => {
    const name = $('vision-name').value.trim();
    if (!name) { status.textContent = 'Enter a profile name.'; $('vision-name').focus(); return; }
    if (profiles.some(profile => profile.name.toLowerCase() === name.toLowerCase())) {
      status.textContent = 'A profile with that name already exists.';
      return;
    }
    if (profiles.length >= 12) { status.textContent = 'Remove a profile before adding another.'; return; }
    analyze('reference', encoding => {
      saveProfiles([...profiles, {id: crypto.randomUUID(), name, encoding}]);
      profileSelect.append(new Option(name, profiles.at(-1).id));
      profileSelect.value = profiles.at(-1).id;
      status.textContent = 'Profile saved in this browser.';
    });
  };

  match.onclick = () => {
    const candidates = profiles.filter(profile => !profileSelect.value || profile.id === profileSelect.value);
    analyze('candidate', encoding => {
      const nearest = candidates.map(profile => ({name: profile.name, distance: faceDistance(profile.encoding, encoding)}))
        .sort((a, b) => a.distance - b.distance)[0];
      if (!nearest) return;
      const found = nearest.distance <= threshold;
      $('vision-result-title').textContent = found ? 'Possible match · ' + nearest.name : 'No saved match';
      $('vision-result-detail').textContent = 'Face distance ' + nearest.distance.toFixed(3) + ' · match cutoff ' + threshold.toFixed(2);
      result.dataset.match = String(found);
      result.hidden = false;
      status.textContent = 'Local comparison complete.';
    });
  };

  window.addEventListener('pagehide', stopCamera);
  refresh();
  return stopCamera;
}
