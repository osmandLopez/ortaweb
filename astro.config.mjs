import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

// Arquitectura de islas: el catálogo se renderiza en el servidor (SEO + velocidad)
// y solo el carrito, el checkout y los formularios del panel hidratan JS en el cliente.
export default defineConfig({
  site: 'https://ortanovedades.mx',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
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
