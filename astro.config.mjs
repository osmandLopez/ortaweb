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
  // imageService: Vercel optimiza las imagenes con su propia API, tomandolas de
  // la URL del CDN. Sin esto, en output:'server' el endpoint /_image corre dentro
  // de la funcion serverless y necesita leer el PNG del disco de la funcion, pero
  // los archivos de src/assets solo se copian a static/. Resultado en produccion:
  // /_image no encuentra el origen y toda imagen optimizada se rompe, aunque en
  // localhost funcione (ahi el dev server lee src/assets del disco real).
  adapter: vercel({
    imageService: true,
    // Vercel solo sirve anchos que esten en esta lista y el adaptador redondea al
    // mas cercano. Sin los tamanos pequenos, el logo (que se pide a 200px) caia
    // en 640 y bajaba una imagen 3 veces mas grande de lo necesario.
    imagesConfig: {
      sizes: [128, 256, 384, 640, 750, 828, 1080, 1200, 1920],
    },
  }),
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
