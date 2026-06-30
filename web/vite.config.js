import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  // snarkjs uses some Node-ish globals when proving in the browser
  define: { global: 'globalThis' },
  optimizeDeps: { exclude: ['snarkjs'] }
});
