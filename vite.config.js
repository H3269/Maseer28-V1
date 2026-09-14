import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/Maseer28-V39-Test/',
  plugins: [react()],
  build: { target: 'es2020', sourcemap: false },
});
