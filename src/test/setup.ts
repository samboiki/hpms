import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Iconify downloads icon data and sets state from a timer, which can fire after a test file's environment is torn
// down ("window is not defined", an unhandled error that fails the whole run). Tests never need real icons, so every
// file gets an empty Icon; a test file that mocks '@iconify/react' itself (e.g. to see icon names) keeps its own mock.
vi.mock('@iconify/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@iconify/react')>()),
  Icon: () => null,
}));
