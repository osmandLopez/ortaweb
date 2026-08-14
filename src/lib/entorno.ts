/**
 * Lectura de variables de entorno.
 *
 * Astro las expone en import.meta.env; los scripts de mantenimiento bajo tsx y
 * el runtime de Vercel solo tienen process.env. Se consultan las dos.
 */

/* Vite no deja `import.meta.env` como un objeto vivo: lo sustituye en el build
   por un literal con los valores que había al compilar. Por eso se guarda aquí
   como lo que es, una foto del build, y se consulta en segundo lugar. */
const delBuild = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

export function env(clave: string): string | undefined {
  /* process.env manda: es lo único que refleja las variables reales del
     despliegue. Si se leyera antes la foto del build, cambiar una variable en el
     panel de Vercel no tendría efecto, y peor: un valor local horneado al
     compilar (DATABASE_URL=file:…) ganaría en producción. */
  return process.env[clave] ?? delBuild[clave];
}

/** true cuando corre en Vercel, en cualquier entorno de despliegue. */
export const enVercel = Boolean(env('VERCEL'));

/**
 * Origen absoluto del sitio. Stripe lo usa para las URLs de retorno y Better
 * Auth para firmar y validar las cookies de sesión.
 *
 * En Vercel, VERCEL_URL trae el dominio del despliegue, así que el sitio
 * funciona sin configurar nada; PUBLIC_SITE_URL lo sobrescribe cuando ya hay
 * dominio propio, que es lo que conviene en producción para que los enlaces de
 * los correos no apunten a una URL de previsualización.
 */
export function sitioUrl(): string {
  const explicito = env('PUBLIC_SITE_URL');
  if (explicito) return explicito.replace(/\/$/, '');

  const vercel = env('VERCEL_URL');
  if (vercel) return `https://${vercel}`;

  return 'http://localhost:4321';
}

/** A dónde apunta la base. En local, el archivo SQLite de desarrollo. */
export const urlBaseDeDatos = env('DATABASE_URL') ?? 'file:./orta.db';

/**
 * Modo demo: el sitio se sirve con el catálogo de muestra en memoria.
 *
 * En Vercel el disco es de solo lectura y efímero, así que un DATABASE_URL de
 * archivo no puede funcionar. Antes eso reventaba al cargar el módulo y dejaba
 * el sitio entero en 500; ahora arranca con datos de muestra, que es lo que hace
 * falta para enseñar el sitio antes de contratar la base.
 *
 * En cuanto DATABASE_URL apunte a Turso (libsql://…), esto pasa a false solo y
 * el sitio usa la base real sin tocar código.
 */
export const modoDemo = enVercel && urlBaseDeDatos.startsWith('file:');

if (modoDemo) {
  console.warn(
    '[orta] Modo demo: sin DATABASE_URL remota, el catálogo sale del seed en memoria y ' +
      'nada de lo que se escriba se conserva. Define DATABASE_URL (libsql://…) y ' +
      'DATABASE_AUTH_TOKEN en las variables de entorno del proyecto para usar la base real.',
  );
}
