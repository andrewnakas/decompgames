import { defineConfig } from 'astro/config';
export default defineConfig({ site: 'https://decompgames.com', output: 'static', trailingSlash: 'always', publicDir:'static', devToolbar:{enabled:false}, vite:{server:{watch:{usePolling:true,interval:1000,ignored:['**/public/**']}}} });
