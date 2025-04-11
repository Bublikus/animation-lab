import { defineConfig } from 'vite';

export default defineConfig({
    base: '/animation-lab/',
    server: {
        port: 3000
    },
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: true
    }
}); 