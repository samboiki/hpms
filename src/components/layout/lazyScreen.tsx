/**
 * Screens whose code is loaded when they are first opened (wave 9), and what shows when that code cannot be loaded:
 * never an empty screen. A failed load is tried again by itself (src/utils/loadWithRetry.ts); if it still fails, the
 * screen says so ("This page could not load") with "Try again", which loads it again without reloading the app, and a
 * way back to the Dashboard. Nothing changes when the code loads, and any other error inside the screen goes where it
 * went before. The notice is the app's error notice (ScreenAccessNotice's "Could not check your access").
 */
import { Component, lazy, useId, useState, type ComponentType, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { PageShell } from './PageHeader';
// The app's action colour (cyan) for buttons, as on the access notice
import { PRIMARY, SECONDARY } from '../stock/stockButtons';
import { CodeLoadError, loadWithRetry } from '../../utils/loadWithRetry';

type Loader<P> = () => Promise<{ default: ComponentType<P> }>;
/** A staff page (offers the Dashboard), a screen a patient sees (no Dashboard to go to), a window over a page */
type Place = 'page' | 'patient' | 'window';

interface NoticeProps {
  place: Place;
  onRetry: () => void;
  onClose?: () => void;
}

function LoadFailureNotice({ place, onRetry, onClose }: NoticeProps) {
  const headingId = useId();
  const card = (
    <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-sm sm:p-8">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
        <Icon icon="solar:cloud-cross-bold-duotone" className="h-7 w-7 text-gray-500" aria-hidden="true" />
      </div>
      <h2 id={headingId} className="mt-4 text-lg font-semibold text-gray-900">
        {place === 'window' ? 'This window could not load' : 'This page could not load'}
      </h2>
      <p className="mt-2 text-sm text-gray-600">Check the connection and try again.</p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button type="button" onClick={onRetry} className={PRIMARY} autoFocus={place === 'window'}>
          Try again
        </button>
        {place === 'page' && (
          <Link to="/" className={SECONDARY}>
            Open the dashboard
          </Link>
        )}
        {place === 'window' && onClose && (
          <button type="button" onClick={onClose} className={SECONDARY}>
            Close
          </button>
        )}
      </div>
    </div>
  );

  if (place === 'window') {
    return (
      // Above the page and the visit tracker, as the patient file and financial windows are
      <div role="dialog" aria-modal="true" aria-labelledby={headingId} className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
        {card}
      </div>
    );
  }
  return (
    <PageShell>
      <section aria-labelledby={headingId} className="flex justify-center py-6 md:py-10">
        {card}
      </section>
    </PageShell>
  );
}

interface BoundaryProps {
  failure: ReactNode;
  onFailed: () => void;
  children: ReactNode;
}

/** Shows `failure` when the screen's code could not be loaded; every other error is passed on unchanged */
class LoadFailureBoundary extends Component<BoundaryProps, { error: unknown; caught: boolean }> {
  state = { error: undefined as unknown, caught: false };

  static getDerivedStateFromError(error: unknown) {
    return { error, caught: true };
  }

  componentDidCatch(error: unknown) {
    if (error instanceof CodeLoadError) this.props.onFailed();
  }

  render() {
    if (!this.state.caught) return this.props.children;
    if (!(this.state.error instanceof CodeLoadError)) throw this.state.error;
    return this.props.failure;
  }
}

function lazyWithRecovery<P extends object>(load: Loader<P>, failure: (props: P, retry: () => void) => ReactNode): ComponentType<P> {
  // React's types cannot see that a lazy ComponentType<P> takes P
  const fresh = () => lazy(() => loadWithRetry(load)) as unknown as ComponentType<P>;
  // One copy for every visit, so a screen opened before comes up at once; a new copy once a load has failed
  const shared = { Screen: fresh(), failed: false };

  return function LazyScreen(props: P) {
    const [current, setCurrent] = useState(() => {
      if (shared.failed) {
        shared.Screen = fresh();
        shared.failed = false;
      }
      return { Screen: shared.Screen, attempt: 0 };
    });
    const retry = () => {
      shared.Screen = fresh();
      shared.failed = false;
      setCurrent((previous) => ({ Screen: shared.Screen, attempt: previous.attempt + 1 }));
    };
    const { Screen } = current;
    return (
      <LoadFailureBoundary key={current.attempt} failure={failure(props, retry)} onFailed={() => { shared.failed = true; }}>
        <Screen {...props} />
      </LoadFailureBoundary>
    );
  };
}

/** A staff page, shown inside the layout under the page spinner (Suspense) while its code arrives */
export function lazyPage(load: Loader<object>): ComponentType<object> {
  return lazyWithRecovery(load, (_props, retry) => <LoadFailureNotice place="page" onRetry={retry} />);
}

/** A screen a patient sees (the patient app, a booking's questions): there is no Dashboard to go back to */
export function lazyPatientScreen(load: Loader<object>): ComponentType<object> {
  return lazyWithRecovery(load, (_props, retry) => <LoadFailureNotice place="patient" onRetry={retry} />);
}

/** A window opened over a page: if its code cannot load, the notice is a window that closes the way it would */
export function lazyWindow<P extends { isOpen: boolean; onClose: () => void }>(load: Loader<P>): ComponentType<P> {
  return lazyWithRecovery(load, (props, retry) =>
    props.isOpen ? <LoadFailureNotice place="window" onRetry={retry} onClose={props.onClose} /> : null
  );
}
