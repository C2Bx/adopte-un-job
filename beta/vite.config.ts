import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Le site est servi depuis un sous-dossier : sans `base`, tous les chemins
// d'assets pointeraient sur la racine du domaine et la page resterait blanche.
export default defineConfig({
  base: '/avp/',
  plugins: [react()],
  build: {
    outDir: 'dist',                 // à déposer tel quel sous /avp/ du site
    emptyOutDir: true,
    target: 'es2020',
  },
  server: {
    proxy: {
      // En développement, l'API de production répond ; on évite CORS.
      // le relais vers l'API de l'équipe (pas de CORS chez eux)
      '/avp/relais.php': { target: 'https://zako.nc', changeOrigin: true, secure: false },
    },
  },
})
