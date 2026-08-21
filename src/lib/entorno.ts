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
 * Origen absoluto y canónico del sitio: el que va en los enlaces de los correos
 * y en las URLs de retorno de Stripe.
 *
 * Orden a propósito: PUBLIC_SITE_URL manda siempre, porque es la única que sabe
 * cuál es el dominio real de la tienda. Sin ella, en producción se usa el
 * dominio estable del proyecto y en previsualización el del propio deploy, de
 * modo que el sitio funciona en Vercel sin configurar nada y una URL de preview
 * nunca se cuela en un correo de producción.
 *
 * Ojo: esto es la URL canónica, no la lista de orígenes válidos. Para eso está
 * `origenesConfiables()`.
 */
export function sitioUrl(): string {
  const explicito = env('PUBLIC_SITE_URL');
  if (explicito) return normalizarOrigen(explicito) ?? 'http://localhost:4321';

  /* En producción manda el dominio del proyecto, no el de este despliegue:
     VERCEL_URL siempre trae la URL única e irrepetible del deploy
     (orta-abc123-org.vercel.app), y un enlace de correo firmado con ella
     caduca en cuanto se publica el siguiente. VERCEL_PROJECT_PRODUCTION_URL
     es el dominio estable: el propio si está configurado, si no el del
     proyecto. */
  if (env('VERCEL_ENV') === 'production') {
    const propio = normalizarOrigen(env('VERCEL_PROJECT_PRODUCTION_URL'));
    if (propio) return propio;
  }

  // En previsualización sí interesa el deploy concreto: es la URL que se abre.
  const deploy = normalizarOrigen(env('VERCEL_URL'));
  if (deploy) return deploy;

  return `http://localhost:${env('PORT') ?? '4321'}`;
}

/** Deja `midominio.mx`, `https://midominio.mx/` y variantes en `https://midominio.mx`. */
function normalizarOrigen(valor: string | undefined): string | null {
  if (!valor) return null;
  const conEsquema = /^https?:\/\//.test(valor) ? valor : `https://${valor}`;
  try {
    return new URL(conEsquema).origin;
  } catch {
    return null;
  }
}

/**
 * Orígenes que Better Auth acepta al comprobar la cabecera `Origin`.
 *
 * Esa comprobación es la protección CSRF del backend de autenticación, así que
 * la lista es un allowlist explícito, nunca `*`. El error `Invalid origin` al
 * registrarse aparecía porque solo se confiaba en `baseURL`: en Vercel el
 * navegador manda el dominio por el que entró (el de producción, el del deploy
 * o el de la rama) y ese no siempre coincide con el de PUBLIC_SITE_URL.
 *
 * Todo lo que se añade aquí sale de variables que solo puede fijar el dueño del
 * despliegue: nada llega desde la petición.
 */
export function origenesConfiables(): string[] {
  const lista = new Set<string>();
  const agregar = (valor: string | undefined) => {
    const origen = normalizarOrigen(valor);
    if (origen) lista.add(origen);
  };

  agregar(sitioUrl());
  agregar(env('PUBLIC_SITE_URL'));
  // Las tres que expone Vercel: dominio del proyecto, del deploy y de la rama.
  agregar(env('VERCEL_PROJECT_PRODUCTION_URL'));
  agregar(env('VERCEL_URL'));
  agregar(env('VERCEL_BRANCH_URL'));

  /* apex y www son el mismo sitio y Vercel suele redirigir de uno a otro; si el
     usuario se registra desde el que no está configurado, el Origin no casaba.
     Solo para el dominio propio: en las URLs de vercel.app el www no existe. */
  const canonico = normalizarOrigen(env('PUBLIC_SITE_URL') ?? env('VERCEL_PROJECT_PRODUCTION_URL'));
  if (canonico) {
    const u = new URL(canonico);
    if (u.hostname.includes('.') && !u.hostname.endsWith('.vercel.app')) {
      u.hostname = u.hostname.startsWith('www.') ? u.hostname.slice(4) : `www.${u.hostname}`;
      lista.add(u.origin);
    }
  }

  /* En desarrollo el puerto no es fijo: Astro salta a 4322 si 4321 está ocupado.
     El comodín cubre solo la máquina del desarrollador —`localhost.loquesea`
     no casa— y nunca se activa en un despliegue. */
  if (!enVercel) {
    lista.add('http://localhost:*');
    lista.add('http://127.0.0.1:*');
  }

  return [...lista];
}

/*
 * A dónde apunta la base. En local, el archivo SQLite de desarrollo.
 *
 * TURSO_DATABASE_URL es el nombre que usa la integración de Turso en el
 * Marketplace de Vercel, que las inyecta sola al conectar la base. Se acepta
 * como alias para que ese camino funcione sin duplicar nada a mano; DATABASE_URL
 * manda si están las dos.
 */
export const urlBaseDeDatos = env('DATABASE_URL') ?? env('TURSO_DATABASE_URL') ?? 'file:./orta.db';

/** El token de la base remota, con el mismo alias que la URL. */
export function tokenBaseDeDatos(): string | undefined {
  return env('DATABASE_AUTH_TOKEN') ?? env('TURSO_AUTH_TOKEN');
}

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
