import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Read a Render Secret File only if the matching environment variable is absent.
 * Render mounts secret files at /etc/secrets/<filename>, not as process.env entries.
 * Fixed filenames avoid accepting user-controlled paths. Nothing is logged or sent
 * to the frontend. Failure is closed: absent files mean an unconfigured provider.
 */
export function resolveServerSecret(name, { environment = process.env, directory = '/etc/secrets' } = {}) {
  if (!['GITHUB_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET'].includes(name)) {
    throw new TypeError('Unsupported server secret name.');
  }
  const configured = environment[name];
  if (typeof configured === 'string' && configured.trim()) return configured.trim();

  const filename = join(directory, name);
  let stats;
  try {
    stats = lstatSync(filename);
  } catch (error) {
    if (error?.code === 'ENOENT') return '';
    // Fail closed, and deliberately omit filesystem paths / secret contents.
    throw new Error('Cannot inspect ' + name + ' secret file.', { cause: error });
  }
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size < 1 || stats.size > 8192) {
    throw new Error(name + ' secret file must be a nonempty regular file of at most 8 KB.');
  }
  try {
    const secret = readFileSync(filename, 'utf8').trim();
    if (!secret) return '';
    return secret;
  } catch (error) {
    throw new Error('Cannot read ' + name + ' secret file.', { cause: error });
  }
}

export function withOAuthSecrets(environment = process.env, options = {}) {
  return {
    ...environment,
    GITHUB_CLIENT_SECRET: resolveServerSecret('GITHUB_CLIENT_SECRET', { environment, ...options }),
    GOOGLE_CLIENT_SECRET: resolveServerSecret('GOOGLE_CLIENT_SECRET', { environment, ...options })
  };
}
