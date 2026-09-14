import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Le site est servi depuis un sous-dossier : sans `base`, tous les chemins
// d'assets pointeraient sur la racine du domaine et la page resterait blanche.
export default defineConfig({
  base: '/avp/beta/',
  plugins: [react()],
  build: {
    outDir: 'dist',                 // à déposer tel quel sous /avp/beta/ du site
    emptyOutDir: true,
    target: 'es2020',
  },
  server: {
    proxy: {
      // En développement, l'API de production répond ; on évite CORS.
      '/avp/app/api': { target: 'https://zako.nc', changeOrigin: true, secure: false },
    },
  },
})
