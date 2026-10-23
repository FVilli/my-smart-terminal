import path from 'node:path';

/** Resolves a protocol-handler request inside the renderer, rejecting traversal, null bytes, and invalid URIs. */
export function resolveRendererPath(rendererRoot: string, pathname: string): string | null {
  let requested: string;
  try {
    requested = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (requested.includes('\0')) {
    return null;
  }
  const relative = requested === '/' ? 'index.html' : requested.slice(1);
  const root = path.resolve(rendererRoot);
  const file = path.resolve(root, relative);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
    return null;
  }
  return file;
}
