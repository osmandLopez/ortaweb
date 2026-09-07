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
 *
 * El archivo llega como cuerpo crudo con su propio content-type, y el nombre en
 * `?nombre=`. No es multipart a propósito: la protección anti-CSRF de Astro
 * rechaza los POST de tipo formulario cuyo `origin` no coincida con el que ella
 * calcula, y en Vercel ese origen no es ninguno de los dominios del sitio, así
 * que toda subida multipart moría en un 403 antes de llegar hasta aquí.
 *
 * Mandarlo como `image/*` esquiva esa regla —solo mira tipos de formulario— y
 * además es más estricto contra CSRF, no menos: un content-type así obliga al
 * navegador a un preflight que ningún sitio ajeno va a conseguir.
 */

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  if (!almacenamientoListo()) {
    return json(
      {
        error:
          'El almacén de imágenes no está disponible. Comprueba que orta-fotos siga conectado al proyecto en Vercel.',
      },
      503,
    );
  }

  const nombre = new URL(request.url).searchParams.get('nombre') ?? 'foto.jpg';
  const tipo = request.headers.get('content-type') ?? '';
  const datos = await request.arrayBuffer().catch(() => null);

  if (!datos || datos.byteLength === 0) {
    return json({ error: 'No llegó ninguna foto.' }, 400);
  }

  const archivo = new File([datos], nombre, { type: tipo });

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
