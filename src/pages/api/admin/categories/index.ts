import type { APIRoute } from 'astro';
import { z } from 'zod';
import { db, ErrorDeDatos } from '@/lib/db';

export const prerender = false;

const categoriaSchema = z.object({
  nombre: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  padreId: z.string().nullable().default(null),
  acento: z.enum(['cielo', 'oro', 'mistico', 'tinta']).default('tinta'),
  orden: z.number().int().default(99),
  activa: z.boolean().default(true),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export const GET: APIRoute = async () => json(await db.listarCategorias());

export const POST: APIRoute = async ({ request }) => {
  const parsed = categoriaSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? 'Revisa los datos de la categoría.' }, 422);
  }

  const existentes = await db.listarCategorias();
  if (existentes.some((c) => c.slug === parsed.data.slug)) {
    return json({ error: `Ya existe una categoría en /tienda/${parsed.data.slug}.` }, 409);
  }
  // Solo dos niveles: una subcategoría no puede colgar de otra subcategoría.
  if (parsed.data.padreId) {
    const padre = existentes.find((c) => c.id === parsed.data.padreId);
    if (!padre) return json({ error: 'La categoría madre no existe.' }, 422);
    if (padre.padreId) return json({ error: 'El catálogo admite dos niveles: categoría y subcategoría.' }, 422);
  }

  try {
    return json(await db.crearCategoria(parsed.data), 201);
  } catch (e) {
    if (e instanceof ErrorDeDatos) return json({ error: e.message }, 409);
    throw e;
  }
};
