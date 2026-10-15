import { reloadAllowed, updateWaiting } from './appUpdate';
import { mayHaveUnsavedEdits } from './unsavedEdits';

interface UpdateHandlerDeps {
  /** Makes the waiting new version take over (the page reloads once it has) */
  applyNow: () => Promise<unknown> | unknown;
  reload: () => void;
  /** A page that was only just opened and that nobody has touched: nothing on it to lose */
  isFreshPage: () => boolean;
}

/**
 * What the app does when the service worker has news (registerServiceWorker.tsx hands these to the browser's worker).
 * - A new version is waiting: on a fresh page it is switched to at once (so opening the app again is enough to get it);
 *   otherwise the "A new version is ready" bar offers it.
 * - The new version took over (here, or from another window of the app): the page loads it, unless that would lose typed
 *   work, in which case the bar offers it and the person chooses when.
 */
export function createUpdateHandlers(deps: UpdateHandlerDeps): { onNeedRefresh: () => void; onNeedReload: () => void } {
  return {
    onNeedRefresh() {
      if (deps.isFreshPage() && !mayHaveUnsavedEdits()) void deps.applyNow();
      else updateWaiting();
    },
    onNeedReload() {
      if (reloadAllowed()) deps.reload();
      else updateWaiting();
    }
  };
}
