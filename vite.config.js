import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages uses the repository subpath; Vercel preview deployments use the domain root.
  base: process.env.VERCEL ? '/' : '/Maseer28-V1/',
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: false,
  },
});
