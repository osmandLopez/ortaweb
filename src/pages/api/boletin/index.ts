import type { APIRoute } from 'astro';
import { z } from 'zod';
import { db } from '@/lib/db';
import { correoValido } from '@/lib/correo-valido';

export const prerender = false;

/*
 * Alta en el boletín, desde el formulario del pie.
 *
 * Llega como JSON y no como <form method="post">: en Vercel, Astro rechaza con
 * 403 cualquier POST con content-type de formulario (ver
 * src/pages/api/admin/imagenes.ts). Así estuvo roto este formulario desde el
 * primer commit, apuntando además a una ruta que no existía.
 *
 * No se manda correo de bienvenida a propósito: el plan gratuito de Resend da
 * 100 correos al día y los comparte con los de pedidos y verificación. Un bot
 * llenando este formulario los gastaría y dejaría a los clientes sin su
 * confirmación de compra.
 */

const schema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .refine(correoValido, 'Revisa el correo: parece que le falta algo.'),
  /* Campo trampa. Va oculto en el formulario: una persona nunca lo llena y un
     bot que rellena todo sí. */
  sitio: z.string().optional(),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export const POST: APIRoute = async ({ request }) => {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Revisa el correo: parece que le falta algo.' }, 422);

  // Al bot se le responde igual que a una persona, para no darle pistas.
  if (parsed.data.sitio) return json({ ok: true });

  await db.suscribirAlBoletin(parsed.data.email);
  return json({ ok: true });
};
