const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('octoDesktop', {
  saveDocument: (name, bytes) => ipcRenderer.invoke('octo:save-document', name, bytes)
});
