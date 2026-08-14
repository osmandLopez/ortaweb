/**
 * Lectura de variables de entorno.
 *
 * Astro las expone en import.meta.env; los scripts de mantenimiento bajo tsx y
 * el runtime de Vercel solo tienen process.env. Se consultan las dos.
 */
export function env(clave: string): string | undefined {
  return (import.meta as { env?: Record<string, string> }).env?.[clave] ?? process.env[clave];
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
