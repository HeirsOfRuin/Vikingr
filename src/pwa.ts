// Installed-app support (GitHub Pages build only, VITE_PWA=1). Registers the
// service worker under this build's id, so each deploy installs a new worker;
// when it takes control, the page reloads once into the new version. Also
// checks for an update whenever the app comes back to the foreground.
declare const __PWA__: boolean;
declare const __BUILD_ID__: string;

export function registerPwa(): void {
  if (!__PWA__ || !('serviceWorker' in navigator) || window.top !== window) return;
  let reloaded = false;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // first install takes control without a reload; later builds reload once
    if (!hadController || reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`./sw.js?build=${__BUILD_ID__}`, { scope: './', updateViaCache: 'none' })
      .then((reg) => {
        reg.update().catch(() => undefined);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => undefined);
        });
      })
      .catch(() => undefined);
  });
}
