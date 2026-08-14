import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel';

// Arquitectura de islas: el catálogo se renderiza en el servidor (SEO + velocidad)
// y solo el carrito, el checkout y los formularios del panel hidratan JS en el cliente.
export default defineConfig({
  site: 'https://ortanovedades.mx',
  output: 'server',
  // Vercel sirve funciones serverless, no un proceso de Node: con el adaptador
  // de Node el build genera dist/server/entry.mjs, que la plataforma no sabe
  // arrancar, y responde su propio 404 aunque el build haya salido bien.
  adapter: vercel(),
  integrations: [
    preact({ compat: true }),
    tailwind({ applyBaseStyles: false }),
  ],
  vite: {
    ssr: {
      // El SDK de Stripe corre solo en servidor.
      external: ['stripe'],
    },
  },
});
