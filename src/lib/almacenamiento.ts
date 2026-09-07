import { put } from '@vercel/blob';
import { env } from './entorno';

/*
 * Guardado de las fotos de producto.
 *
 * Vive en Vercel Blob y no en la base ni en el repositorio: en Vercel el disco
 * es de solo lectura, así que escribir en /public no es una opción, y meter
 * binarios en Turso haría crecer la base y saldría por la misma conexión que
 * las consultas del catálogo.
 *
 * Hay dos formas de autenticarse y el proyecto usa una distinta en cada sitio:
 *
 * - **En Vercel, OIDC.** Al conectar el almacén al proyecto, Vercel inyecta
 *   BLOB_STORE_ID y le da a la función un permiso temporal (VERCEL_OIDC_TOKEN)
 *   que la librería recoge sola. Ahí NO hay BLOB_READ_WRITE_TOKEN, y por eso no
 *   se le puede exigir: el panel de Vercel lista solo BLOB_STORE_ID y
 *   BLOB_WEBHOOK_PUBLIC_KEY entre las variables del proyecto.
 * - **En local, el token de siempre.** Fuera de Vercel no hay OIDC, así que hace
 *   falta copiar BLOB_READ_WRITE_TOKEN al .env a mano.
 *
 * De ahí que `put` reciba `token` solo cuando existe: pasarlo vacío o inventado
 * anularía el camino de OIDC.
 */

/** Formatos que aceptamos. Nada de SVG: admite scripts dentro. */
const TIPOS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

/** 6 MB. El formulario ya reduce las fotos antes de mandarlas; esto es el tope duro. */
export const TAMANO_MAXIMO = 6 * 1024 * 1024;

export class ErrorDeAlmacenamiento extends Error {}

/**
 * true cuando hay con qué autenticarse: el token en local, o el almacén
 * conectado al proyecto en Vercel. Se consulta para dar un mensaje claro en vez
 * de dejar que la subida reviente con la excepción de la librería.
 */
export function almacenamientoListo(): boolean {
  return Boolean(env('BLOB_READ_WRITE_TOKEN') ?? env('BLOB_STORE_ID'));
}

export function validarImagen(archivo: File): string | null {
  if (!TIPOS.has(archivo.type)) {
    return 'Esa foto no es JPG, PNG, WebP ni AVIF. Guárdala en uno de esos formatos.';
  }
  if (archivo.size > TAMANO_MAXIMO) {
    return 'La foto pesa más de 6 MB. Redúcela antes de subirla.';
  }
  return null;
}

/**
 * Sube una imagen y devuelve su URL pública.
 *
 * El nombre se normaliza y se le añade un sufijo aleatorio (`addRandomSuffix`),
 * así dos fotos llamadas "IMG_1234.jpg" de productos distintos no se pisan.
 */
export async function subirImagen(archivo: File): Promise<string> {
  if (!almacenamientoListo()) {
    throw new ErrorDeAlmacenamiento(
      'El almacén de imágenes no está disponible: fuera de Vercel hace falta BLOB_READ_WRITE_TOKEN en el .env.',
    );
  }

  const limpio = archivo.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(-80);

  const token = env('BLOB_READ_WRITE_TOKEN');

  const { url } = await put(`productos/${limpio || 'foto.jpg'}`, archivo, {
    access: 'public',
    addRandomSuffix: true,
    contentType: archivo.type,
    // Sin token, la librería se autentica sola con el OIDC de Vercel.
    ...(token ? { token } : {}),
  });

  return url;
}
