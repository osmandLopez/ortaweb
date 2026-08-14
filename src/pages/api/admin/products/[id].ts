import type { APIRoute } from 'astro';
import { db, ErrorDeDatos } from '@/lib/db';
import { productoSchema } from './index';

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export const PUT: APIRoute = async ({ params, request }) => {
  const cuerpo = await request.json().catch(() => null);
  const parsed = productoSchema.partial().safeParse(cuerpo);
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? 'Revisa los datos del producto.' }, 422);
  }

  try {
    const actualizado = await db.actualizarProducto(params.id!, parsed.data);
    if (!actualizado) return json({ error: 'Ese producto ya no existe.' }, 404);
    return json(actualizado);
  } catch (e) {
    if (e instanceof ErrorDeDatos) return json({ error: e.message }, 409);
    throw e;
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const ok = await db.eliminarProducto(params.id!);
    if (!ok) return json({ error: 'Ese producto ya no existe.' }, 404);
    return new Response(null, { status: 204 });
  } catch (e) {
    // Un producto con pedidos no se borra: se oculta y se dice por qué.
    if (e instanceof ErrorDeDatos) return json({ error: e.message }, 409);
    throw e;
  }
};
