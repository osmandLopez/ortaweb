/*
 * Carga .env en process.env para todo lo que corre fuera de Astro.
 *
 * El dev server y el build leen .env por su cuenta —lo hace Vite— pero
 * drizzle-kit y los scripts bajo tsx no: arrancan con el entorno pelado del
 * sistema. Hasta ahora eso pasaba desapercibido porque DATABASE_URL tiene un
 * valor por omisión (file:./orta.db) y `npm run db:migrate` parecía funcionar.
 * Con Turso el fallo es mucho peor: el comando dice que migró, lo hizo sobre el
 * archivo de desarrollo, y la base remota se queda vacía hasta que el sitio
 * publicado responde 500 en la primera consulta.
 *
 * process.loadEnvFile viene en Node (>= 20.12), así que no hace falta dotenv.
 * No pisa lo que ya traiga el entorno real: si exportas DATABASE_URL en la
 * terminal, o corres esto en un CI con las variables puestas, mandan esas.
 *
 * Se importa como efecto secundario y siempre en primer lugar: los módulos ESM
 * se evalúan en el orden en que aparecen sus imports, y src/lib/sqlite.ts abre
 * la conexión al cargarse. Un import más arriba y la conexión se abriría contra
 * la base equivocada.
 */
import { fileURLToPath } from 'node:url';

// Relativo a este archivo, no al directorio desde el que se invoca el script.
const ruta = fileURLToPath(new URL('../.env', import.meta.url));

try {
  process.loadEnvFile(ruta);
} catch {
  /* Sin .env no hay nada que hacer aquí: en un despliegue las variables ya
     vienen del entorno, y en local el propio script dirá qué le falta. */
}
