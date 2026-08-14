import type { APIRoute } from 'astro';
import { cotizar, cpValido } from '@/lib/shipping';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const { cp, subtotal } = (await request.json().catch(() => ({}))) as { cp?: string; subtotal?: number };

  if (!cp || !cpValido(cp)) {
    return new Response(JSON.stringify({ error: 'El código postal son 5 dígitos.' }), {
      status: 422,
      headers: { 'content-type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(cotizar(cp, Number(subtotal) || 0)), {
    headers: { 'content-type': 'application/json' },
  });
};
