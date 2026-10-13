/**
 * Screens loaded when first opened must never leave an empty screen when their code does not arrive (a dropped
 * connection on mobile data): they try again by themselves, then say "This page could not load" with "Try again",
 * which loads them without reloading the app (a reload of a deep link is "page not found" on the server today).
 * Nothing changes when the code arrives. The retries wait 0.4 and 1.2 seconds, so a failure shows after about 1.6.
 */
import React, { Suspense } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { lazyPage, lazyPatientScreen, lazyWindow } from '../lazyScreen';

afterEach(cleanup);

const WAIT = { timeout: 5000 };
// What a failed download looks like in Safari (no file named, so the import itself is tried again)
const dropped = () => new TypeError('Importing a module script failed.');
const InventedPage = () => <h1>Invented page</h1>;
// An import that fails `times` times, then delivers the page
const flaky = (times: number) => {
  let left = times;
  return vi.fn(() => (left-- > 0 ? Promise.reject(dropped()) : Promise.resolve({ default: InventedPage })));
};

const show = (Screen: React.ComponentType<object>) =>
  render(
    <MemoryRouter>
      <Suspense fallback={<p>Loading the page</p>}>
        <Screen />
      </Suspense>
    </MemoryRouter>
  );

describe('a page whose code is loaded when it is opened', () => {
  it('shows the page as before when its code arrives', async () => {
    const load = flaky(0);
    show(lazyPage(load));
    expect(await screen.findByRole('heading', { name: 'Invented page' })).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('shows the page, and no notice, when the first download fails and the next one works', async () => {
    const load = flaky(1);
    show(lazyPage(load));
    expect(await screen.findByRole('heading', { name: 'Invented page' }, WAIT)).toBeInTheDocument();
    expect(screen.queryByText('This page could not load')).toBeNull();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('says it could not load instead of showing an empty screen, and Try again loads it without reloading the app', async () => {
    const load = flaky(3);
    show(lazyPage(load));
    expect(await screen.findByRole('heading', { name: 'This page could not load' }, WAIT)).toBeInTheDocument();
    expect(screen.getByText('Check the connection and try again.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the dashboard' })).toHaveAttribute('href', '/');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Invented page' }, WAIT)).toBeInTheDocument();
    expect(screen.queryByText('This page could not load')).toBeNull();
    expect(load).toHaveBeenCalledTimes(4);
  });

  // Going to the Dashboard and opening the page again later must not show the old failure at once
  it('tries again when the page is opened again after a failed load', async () => {
    const load = flaky(3);
    const Page = lazyPage(load);
    const first = show(Page);
    await screen.findByRole('heading', { name: 'This page could not load' }, WAIT);
    first.unmount();

    show(Page);
    expect(await screen.findByRole('heading', { name: 'Invented page' }, WAIT)).toBeInTheDocument();
  });

  // A mistake inside a page that did load is not a connection problem: it is passed on as before
  it('passes on an error from a page that did load, instead of blaming the connection', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const Broken = () => {
      throw new Error('A mistake in the page');
    };
    class Outer extends React.Component<{ children: React.ReactNode }, { message: string | null }> {
      state = { message: null as string | null };
      static getDerivedStateFromError(error: Error) {
        return { message: error.message };
      }
      render() {
        return this.state.message ? <p>Passed on: {this.state.message}</p> : this.props.children;
      }
    }
    const Page = lazyPage(() => Promise.resolve({ default: Broken }));
    render(
      <Outer>
        <MemoryRouter>
          <Suspense fallback={null}>
            <Page />
          </Suspense>
        </MemoryRouter>
      </Outer>
    );
    expect(await screen.findByText('Passed on: A mistake in the page')).toBeInTheDocument();
    expect(screen.queryByText('This page could not load')).toBeNull();
    quiet.mockRestore();
  });
});

describe("a patient's screen (the patient app, a booking's questions)", () => {
  it('says it could not load with Try again, and offers no Dashboard, which patients do not have', async () => {
    show(lazyPatientScreen(flaky(3)));
    expect(await screen.findByRole('heading', { name: 'This page could not load' }, WAIT)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open the dashboard' })).toBeNull();
  });
});

describe('a window opened over a page', () => {
  type WindowProps = { isOpen: boolean; onClose: () => void };
  const InventedWindow = ({ isOpen }: WindowProps) => (isOpen ? <h1>Invented window</h1> : null);
  const flakyWindow = (times: number) => {
    let left = times;
    return vi.fn(() => (left-- > 0 ? Promise.reject(dropped()) : Promise.resolve({ default: InventedWindow })));
  };

  it('says the window could not load, closes the way the window would, and Try again opens it', async () => {
    const onClose = vi.fn();
    const Window = lazyWindow(flakyWindow(3));
    render(
      <Suspense fallback={null}>
        <Window isOpen onClose={onClose} />
      </Suspense>
    );
    expect(await screen.findByRole('dialog', { name: 'This window could not load' }, WAIT)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Invented window' }, WAIT)).toBeInTheDocument();
  });
});
