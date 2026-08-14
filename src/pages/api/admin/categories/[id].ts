import type { APIRoute } from 'astro';
import { db, ErrorDeDatos } from '@/lib/db';

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const ok = await db.eliminarCategoria(params.id!);
    if (!ok) return json({ error: 'Esa categoría ya no existe.' }, 404);
    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof ErrorDeDatos) return json({ error: e.message }, 409);
    throw e;
  }
};
