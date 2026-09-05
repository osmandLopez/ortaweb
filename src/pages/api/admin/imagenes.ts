import type { APIRoute } from 'astro';
import {
  almacenamientoListo,
  ErrorDeAlmacenamiento,
  subirImagen,
  validarImagen,
} from '@/lib/almacenamiento';

export const prerender = false;

/*
 * Subida de fotos de producto. El middleware ya bloqueó a quien no sea admin
 * (/api/admin está en RUTAS_PROTEGIDAS), así que aquí solo se valida el archivo.
 *
 * Devuelve la URL pública; el formulario la añade a la lista de imágenes del
 * producto. La foto queda subida aunque después no se guarde el producto: es
 * preferible una foto huérfana en el almacén a perder la subida por un error de
 * validación en otro campo.
 */

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  if (!almacenamientoListo()) {
    return json(
      {
        error:
          'El almacén de imágenes no está configurado. Falta la variable BLOB_READ_WRITE_TOKEN en el proyecto.',
      },
      503,
    );
  }

  const formulario = await request.formData().catch(() => null);
  const archivo = formulario?.get('archivo');

  if (!(archivo instanceof File) || archivo.size === 0) {
    return json({ error: 'No llegó ninguna foto.' }, 400);
  }

  const problema = validarImagen(archivo);
  if (problema) return json({ error: problema }, 422);

  try {
    return json({ url: await subirImagen(archivo) }, 201);
  } catch (e) {
    if (e instanceof ErrorDeAlmacenamiento) return json({ error: e.message }, 503);
    console.error('[orta] Falló la subida de imagen:', e);
    return json({ error: 'No se pudo subir la foto. Inténtalo otra vez.' }, 502);
  }
};
