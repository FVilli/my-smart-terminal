import path from 'node:path';

export function formatWindowTitle(version: string): string {
  return `Smart Terminal - Version ${version}`;
}

export function resolveWindowIcon(isPackaged: boolean, resourcesPath: string, projectRoot: string): string {
  return isPackaged
    ? path.join(resourcesPath, 'icon.png')
    : path.join(projectRoot, 'apps', 'desktop', 'build', 'icon-linux.png');
}
