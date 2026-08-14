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

/**
 * Falla temprano y con un mensaje que se entiende.
 *
 * El error por defecto de libSQL al no encontrar las tablas no dice nada del
 * problema real, que es haber desplegado apuntando a un archivo local.
 */
export function verificarBaseDeDatos(url: string): void {
  if (!enVercel) return;
  if (!url.startsWith('file:')) return;

  throw new Error(
    'DATABASE_URL apunta a un archivo local (' + url + ') y en Vercel el disco es de solo lectura y efímero. ' +
      'Crea una base en Turso, aplica las migraciones con `npm run db:migrate`, y define DATABASE_URL ' +
      '(libsql://…) y DATABASE_AUTH_TOKEN en las variables de entorno del proyecto.',
  );
}
