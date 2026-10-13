import { describe, it, expect } from 'vitest';
import { getBackButtonAction } from '../backButton';

// Android users expect Back to step back through the app and, on the first screen, to leave it. It must never
// strand them (Back doing nothing) or walk them back through the sign-in history.
describe('getBackButtonAction', () => {
  it('goes back one screen from a page deeper in the app', () => {
    expect(getBackButtonAction('/patients', true)).toBe('go-back');
    expect(getBackButtonAction('/patients/123/visit/456', true)).toBe('go-back');
  });

  it('leaves the app from the dashboard, although signing in left a history entry behind it', () => {
    expect(getBackButtonAction('/', true)).toBe('leave-app');
  });

  it('leaves the app from the sign-in page instead of revisiting pages from before signing out', () => {
    expect(getBackButtonAction('/login', true)).toBe('leave-app');
  });

  it('leaves the app from the patient app home, the first screen a patient sees after signing in', () => {
    // Going back from there would only reach the sign-in page or the redirect to /me again
    expect(getBackButtonAction('/me', true)).toBe('leave-app');
    expect(getBackButtonAction('/me/', true)).toBe('leave-app');
    // Deeper patient screens step back to the patient home like any other page
    expect(getBackButtonAction('/me/results', true)).toBe('go-back');
  });

  it('leaves the app when there is nothing to go back to, instead of ignoring the button', () => {
    expect(getBackButtonAction('/settings', false)).toBe('leave-app');
  });

  it('treats a trailing slash as the same page', () => {
    expect(getBackButtonAction('/login/', true)).toBe('leave-app');
    expect(getBackButtonAction('/settings/', true)).toBe('go-back');
  });
});
