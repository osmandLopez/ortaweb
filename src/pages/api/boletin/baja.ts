import type { APIRoute } from 'astro';
import { db } from '@/lib/db';

export const prerender = false;

/*
 * Baja del boletín con el token del enlace que va al final de cada correo.
 *
 * Es un POST que dispara un botón, y no el simple hecho de abrir el enlace: los
 * filtros de correo abren los enlaces para revisarlos, y si bastara con abrirlo
 * darían de baja a la gente sin que nadie lo pidiera.
 */

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const datos = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof datos?.token === 'string' ? datos.token : '';
  if (!token) return json({ error: 'Ese enlace está incompleto.' }, 422);

  const ok = await db.darDeBajaDelBoletin({ token });
  if (!ok) return json({ error: 'Ese enlace ya no sirve: puede que ya te hubieras dado de baja.' }, 404);
  return json({ ok: true });
};
