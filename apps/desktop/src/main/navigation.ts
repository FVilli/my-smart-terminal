/** Navigazione consentita: stessa origin del dev server oppure scheme/host dell'app. */
export function isAllowedNavigation(targetUrl: string, devServerUrl: string | undefined, appScheme: string, appHost: string): boolean {
  try {
    const target = new URL(targetUrl);
    if (devServerUrl !== undefined) {
      return target.origin === new URL(devServerUrl).origin;
    }
    return target.protocol === `${appScheme}:` && target.host === appHost;
  } catch {
    return false;
  }
}
