import type { APIRoute } from 'astro';
import { z } from 'zod';
import { db } from '@/lib/db';
import { crearSesionCheckout } from '@/lib/stripe';
import { cotizar } from '@/lib/shipping';
import { generarFolio } from '@/lib/money';
import { sitioUrl } from '@/lib/entorno';
import type { ItemCarrito, Pedido } from '@/lib/types';

export const prerender = false;

const schema = z.object({
  items: z.array(z.object({
    productoId: z.string(),
    cantidad: z.number().int().positive().max(20),
  })).min(1),
  email: z.string().email('Necesitamos un correo para enviarte la confirmación.'),
  metodoEntrega: z.enum(['envio', 'pickup']),
  cp: z.string().optional(),
  opcionEnvioId: z.string().optional(),
  sucursalId: z.string().optional(),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export const POST: APIRoute = async ({ request, locals, url }) => {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.issues[0]!.message }, 422);
  const datos = parsed.data;

  /* Los precios NUNCA vienen del cliente: se releen de la base con el id del
     producto. El carrito del navegador solo aporta qué y cuánto. */
  const items: ItemCarrito[] = [];
  for (const linea of datos.items) {
    const p = await db.obtenerProductoPorId(linea.productoId);
    if (!p || !p.activo) return json({ error: 'Un artículo de tu carrito ya no está disponible.' }, 409);
    if (p.stock < linea.cantidad) {
      return json({ error: `Solo quedan ${p.stock} de ${p.nombre}. Ajusta la cantidad.` }, 409);
    }
    items.push({
      productoId: p.id, slug: p.slug, nombre: p.nombre, precio: p.precio,
      imagen: p.imagenes[0] ?? '', cantidad: linea.cantidad,
    });
  }

  const subtotal = items.reduce((n, i) => n + i.precio * i.cantidad, 0);

  let envio = null;
  if (datos.metodoEntrega === 'envio') {
    if (!datos.cp) return json({ error: 'Escribe tu código postal para cotizar el envío.' }, 422);
    /* La tarifa también se recalcula en el servidor: el navegador manda cuál
       eligió, no cuánto cuesta. */
    const { opciones } = cotizar(datos.cp, subtotal);
    envio = opciones.find((o) => o.id === datos.opcionEnvioId) ?? opciones[0]!;
  } else if (!datos.sucursalId) {
    return json({ error: 'Elige la sucursal donde vas a recoger.' }, 422);
  }

  const folio = generarFolio();
  const costoEnvio = envio?.costo ?? 0;
  const total = subtotal + costoEnvio;

  /* Si Stripe no responde (o falta la clave), el cliente tiene que enterarse con
     una frase entendible en vez de un 500 con cuerpo vacío. El detalle queda en
     el log del servidor, que es donde sirve. */
  let sesion;
  try {
    sesion = await crearSesionCheckout({
      items,
      envio,
      metodoEntrega: datos.metodoEntrega,
      sucursalId: datos.sucursalId ?? null,
      email: datos.email,
      folio,
      usuarioId: locals.usuario?.id ?? null,
      origen: sitioUrl() || url.origin,
    });
  } catch (e) {
    console.error(`[orta] No se pudo abrir la sesión de pago (${folio}):`, (e as Error).message);
    return json({ error: 'No pudimos abrir el pago ahora mismo. Inténtalo en un momento.' }, 502);
  }

  /* El pedido se guarda como pendiente ANTES de mandar al cliente a Stripe.
     El webhook es quien lo confirma; así ningún cobro queda sin pedido. */
  const pedido: Pedido = {
    id: crypto.randomUUID(),
    folio,
    usuarioId: locals.usuario?.id ?? null,
    emailContacto: datos.email,
    items,
    subtotal,
    envio: costoEnvio,
    total,
    pagado: 0,
    metodoEntrega: datos.metodoEntrega,
    sucursalId: datos.sucursalId ?? null,
    direccion: null,
    estado: 'pendiente_pago',
    stripeSessionId: sesion.id,
    stripePaymentIntentId: null,
    pagadoEn: null,
    creadoEn: new Date().toISOString(),
  };
  await db.crearPedido(pedido);

  return json({ url: sesion.url, folio, total });
};
