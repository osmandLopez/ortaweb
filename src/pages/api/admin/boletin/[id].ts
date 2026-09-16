import type { APIRoute } from 'astro';
import { db } from '@/lib/db';

export const prerender = false;

/* Baja desde el panel: para quien la pide por WhatsApp o al correo de datos
   personales en vez de usar el enlace. */
export const DELETE: APIRoute = async ({ params }) => {
  const ok = await db.darDeBajaDelBoletin({ id: params.id! });
  if (!ok) {
    return new Response(JSON.stringify({ error: 'Esa persona ya no está en la lista.' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Response(null, { status: 204 });
};
