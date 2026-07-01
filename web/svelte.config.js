import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // Pure client-rendered SPA (ssr=false everywhere): snarkjs proving + Stellar RPC/Horizon all run in
    // the browser. `fallback` makes it a single-page app. We intentionally set NO isolation (COOP/COEP)
    // headers, so cross-origin Friendbot / Soroban-RPC / Horizon / stellar.expert fetches keep working;
    // snarkjs proves single-threaded without SharedArrayBuffer, which is fine for the demo.
    adapter: adapter({ fallback: 'index.html', precompress: false, strict: false })
  }
};

export default config;
