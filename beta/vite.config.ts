import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Le site est servi depuis un sous-dossier : sans `base`, tous les chemins
// d'assets pointeraient sur la racine du domaine et la page resterait blanche.
export default defineConfig(({ mode }) => {
  // RELAIS_ORIGINE : l'origine qui sert relais.php (ex. https://exemple.nc).
  // Définie, Vite y renvoie /avp/relais.php en développement (évite CORS) ;
  // absente, aucun proxy n'est configuré.
  const relais = loadEnv(mode, '.', '').RELAIS_ORIGINE

  return {
    base: '/avp/',
    plugins: [react()],
    build: {
      outDir: 'dist',                 // à déposer tel quel sous /avp/ du site
      emptyOutDir: true,
      target: 'es2020',
    },
    server: relais
      ? { proxy: { '/avp/relais.php': { target: relais, changeOrigin: true, secure: false } } }
      : {},
  }
})
