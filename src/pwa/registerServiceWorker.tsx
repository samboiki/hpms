import { registerSW } from 'virtual:pwa-register';
import toast from 'react-hot-toast';

const UPDATE_CHECK_MS = 60 * 60 * 1000; // reception PCs stay open all day: look for a new release every hour

/**
 * Lets the app start offline and be installed. A new release never reloads the page by itself (a doctor may be
 * in the middle of notes): staff get "A new version is ready" and choose when to reload.
 */
export function registerServiceWorker(): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;

  const updateServiceWorker = registerSW({
    onNeedRefresh() {
      toast(
        (t) => (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm">A new version of OneHealth is ready.</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900"
                onClick={() => {
                  toast.dismiss(t.id);
                  void updateServiceWorker(true);
                }}
              >
                Reload
              </button>
              <button type="button" className="rounded-md px-3 py-1.5 text-sm text-white/80" onClick={() => toast.dismiss(t.id)}>
                Later
              </button>
            </div>
          </div>
        ),
        { id: 'pwa-update', duration: Infinity }
      );
    },
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        window.setInterval(() => {
          void registration.update();
        }, UPDATE_CHECK_MS);
      }
    },
    onRegisterError(error) {
      console.error('Offline support could not start:', error);
    }
  });
}
