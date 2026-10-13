/**
 * What the Android Back button (or back gesture) does in the store app. Pure, so it can be tested without a phone.
 *
 * - On most screens it goes back one step, like the browser's Back button.
 * - On the first screen it leaves the app. That is the dashboard at "/", the patient app's home at "/me" and the
 *   sign-in page, even when there is history behind them: signing in adds a second "/" entry, and going back to it
 *   would only show the dashboard again, or the sign-in form after signing out.
 * - With nothing to go back to it leaves the app, instead of ignoring the button.
 */
export const LEAVE_APP_PATHS: readonly string[] = ['/', '/me', '/login'];

export type BackButtonAction = 'go-back' | 'leave-app';

export function getBackButtonAction(pathname: string, canGoBack: boolean): BackButtonAction {
  const path = pathname.replace(/\/+$/, '') || '/';
  return !canGoBack || LEAVE_APP_PATHS.includes(path) ? 'leave-app' : 'go-back';
}
