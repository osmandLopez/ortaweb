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
 * La única pieza de configuración es BLOB_READ_WRITE_TOKEN, que la propia
 * Vercel inyecta al conectar un almacén al proyecto. En local hay que copiarlo
 * al .env a mano.
 */

/** Formatos que aceptamos. Nada de SVG: admite scripts dentro. */
const TIPOS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

/** 6 MB. El formulario ya reduce las fotos antes de mandarlas; esto es el tope duro. */
export const TAMANO_MAXIMO = 6 * 1024 * 1024;

export class ErrorDeAlmacenamiento extends Error {}

/** true cuando hay token configurado. Se consulta para dar un mensaje claro. */
export function almacenamientoListo(): boolean {
  return Boolean(env('BLOB_READ_WRITE_TOKEN'));
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
  const token = env('BLOB_READ_WRITE_TOKEN');
  if (!token) {
    throw new ErrorDeAlmacenamiento(
      'Falta BLOB_READ_WRITE_TOKEN: el almacén de imágenes no está conectado al proyecto.',
    );
  }

  const limpio = archivo.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(-80);

  const { url } = await put(`productos/${limpio || 'foto.jpg'}`, archivo, {
    access: 'public',
    addRandomSuffix: true,
    contentType: archivo.type,
    token,
  });

  return url;
}
