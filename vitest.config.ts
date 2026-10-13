import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // hpms-landing and onehealth are separate Next.js apps: their tests import through their own "@/" (their src/)
    exclude: [...configDefaults.exclude, 'hpms-landing/**', 'onehealth/**'],
  },
});