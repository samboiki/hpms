/**
 * Every error toast in plain words (owner decision 13 Oct 2026: "plain words everywhere").
 *
 * Hundreds of screens and services pass a Supabase error's own text on to toast.error, often wrapped
 * ("Could not save the quote: column "x" does not exist"). Rather than trust each one, the staff app's toast layer
 * (src/components/ui/ToastLayer.tsx) installs this once: a toast that carries database or programming wording shows
 * the plain version (src/utils/plainErrors.ts plainWords) and the original goes to the console for support.
 * Plain messages are shown exactly as written; toasts built from components are left alone.
 */
import toast from 'react-hot-toast';
import { plainWords } from './plainErrors';

let installed = false;

export function installPlainToasts(target: { error: typeof toast.error } = toast): void {
  if (installed && target === toast) return;
  if (target === toast) installed = true;
  const original = target.error;
  target.error = ((message, options) => {
    if (typeof message !== 'string') return original(message, options);
    const plain = plainWords(message);
    if (plain !== message) console.warn('[OneHealth] error toast shown in plain words; the original:', message);
    return original(plain, options);
  }) as typeof toast.error;
}
