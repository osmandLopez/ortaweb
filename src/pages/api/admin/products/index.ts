import type { APIRoute } from 'astro';
import { z } from 'zod';
import { db, ErrorDeDatos } from '@/lib/db';

export const prerender = false;

// El middleware ya bloqueó a quien no sea admin; aquí solo se valida la forma.
export const productoSchema = z.object({
  nombre: z.string().min(3),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'La dirección web solo admite minúsculas, números y guiones.'),
  descripcion: z.string().default(''),
  sku: z.string().min(1),
  precio: z.number().int().positive(),
  precioAnterior: z.number().int().positive().nullable().default(null),
  stock: z.number().int().min(0),
  categoriaId: z.string().min(1),
  imagenes: z.array(z.string()).default([]),
  apartable: z.boolean().default(false),
  anticipoMinimo: z.number().int().min(0).max(100).default(0),
  plazoSemanas: z.number().int().min(0).max(52).default(0),
  temporada: z.boolean().default(false),
  destacado: z.boolean().default(false),
  activo: z.boolean().default(true),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export const GET: APIRoute = async () => json(await db.listarProductos());

export const POST: APIRoute = async ({ request }) => {
  const cuerpo = await request.json().catch(() => null);
  const parsed = productoSchema.safeParse(cuerpo);

  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? 'Revisa los datos del producto.' }, 422);
  }
  if (await db.obtenerProducto(parsed.data.slug)) {
    return json({ error: `Ya hay un producto en /producto/${parsed.data.slug}.` }, 409);
  }
  if (parsed.data.precioAnterior && parsed.data.precioAnterior <= parsed.data.precio) {
    return json({ error: 'El precio anterior debe ser mayor al precio actual.' }, 422);
  }

  try {
    return json(await db.crearProducto(parsed.data), 201);
  } catch (e) {
    // La base también valida unicidad: gana la carrera contra dos altas a la vez.
    if (e instanceof ErrorDeDatos) return json({ error: e.message }, 409);
    throw e;
  }
};
