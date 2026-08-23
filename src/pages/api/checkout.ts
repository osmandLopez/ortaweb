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
  })).min(1).max(50),
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

  /* Las líneas repetidas se suman antes de validar nada. El tope de 20 por línea
     no sirve de nada si el mismo producto puede mandarse en tres líneas: sumadas
     pedirían 60 unidades y cada línea pasaría la comprobación de existencias por
     separado. */
  const pedidas = new Map<string, number>();
  for (const linea of datos.items) {
    pedidas.set(linea.productoId, (pedidas.get(linea.productoId) ?? 0) + linea.cantidad);
  }

  /* Los precios NUNCA vienen del cliente: se releen de la base con el id del
     producto. El carrito del navegador solo aporta qué y cuánto. */
  const items: ItemCarrito[] = [];
  for (const [productoId, cantidad] of pedidas) {
    const p = await db.obtenerProductoPorId(productoId);
    if (!p || !p.activo) return json({ error: 'Un artículo de tu carrito ya no está disponible.' }, 409);
    if (cantidad > 20) return json({ error: `Máximo 20 piezas de ${p.nombre} por pedido.` }, 422);
    if (p.stock < cantidad) {
      return json({ error: `Solo quedan ${p.stock} de ${p.nombre}. Ajusta la cantidad.` }, 409);
    }
    items.push({
      productoId: p.id, slug: p.slug, nombre: p.nombre, precio: p.precio,
      imagen: p.imagenes[0] ?? '', cantidad,
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
  } else {
    /* La sucursal se comprueba contra la base. Antes bastaba con que el campo no
       viniera vacío, así que un id inventado creaba un pedido para recoger en
       una tienda que no existe. */
    if (!datos.sucursalId) return json({ error: 'Elige la sucursal donde vas a recoger.' }, 422);
    const sucursales = await db.listarSucursales();
    if (!sucursales.some((s) => s.id === datos.sucursalId)) {
      return json({ error: 'Esa sucursal ya no está disponible. Elige otra.' }, 409);
    }
  }

  const costoEnvio = envio?.costo ?? 0;
  const total = subtotal + costoEnvio;
  const usuarioId = locals.usuario?.id ?? null;

  /* Si Stripe no responde (o falta la clave), el cliente tiene que enterarse con
     una frase entendible en vez de un 500 con cuerpo vacío. El detalle queda en
     el log del servidor, que es donde sirve. */
  let sesion;
  const folio = generarFolio();
  try {
    sesion = await crearSesionCheckout({
      items,
      envio,
      metodoEntrega: datos.metodoEntrega,
      sucursalId: datos.sucursalId ?? null,
      email: datos.email,
      folio,
      usuarioId,
      origen: sitioUrl() || url.origin,
      claveIdempotencia: await claveDelIntento(datos.email, usuarioId, items, datos.metodoEntrega, costoEnvio),
    });
  } catch (e) {
    console.error(`[orta] No se pudo abrir la sesión de pago (${folio}):`, (e as Error).message);
    return json({ error: 'No pudimos abrir el pago ahora mismo. Inténtalo en un momento.' }, 502);
  }

  /* La clave de idempotencia hace que un reenvío devuelva la sesión que Stripe
     ya había creado, no una nueva. Si es eso lo que pasó, el pedido pendiente
     también existe ya: se devuelve tal cual. Insertarlo otra vez chocaría contra
     el índice único de stripe_session_id y el cliente vería un 500 por haber
     hecho doble clic. */
  const existente = await db.obtenerPedidoPorSesion(sesion.id);
  if (existente) {
    return json({ url: sesion.url, folio: existente.folio, total: existente.total });
  }

  /* El pedido se guarda como pendiente ANTES de mandar al cliente a Stripe.
     El webhook es quien lo confirma; así ningún cobro queda sin pedido. */
  const pedido: Pedido = {
    id: crypto.randomUUID(),
    folio,
    usuarioId,
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

/**
 * Clave de idempotencia del intento de compra.
 *
 * Sale del contenido: mismo cliente, mismo carrito, misma entrega y mismo
 * importe dan la misma clave, así que un doble clic o un reintento de la red
 * recuperan la sesión que Stripe ya abrió en vez de crear una segunda.
 *
 * Lleva dentro un tramo de 15 minutos a propósito. Sin él, la clave viviría las
 * 24 horas que Stripe las guarda y quien volviera al día siguiente con el mismo
 * carrito recibiría su sesión vieja, ya caducada, en vez de una nueva. Con él,
 * la coincidencia solo dura lo que dura un intento de pago de verdad.
 */
async function claveDelIntento(
  email: string,
  usuarioId: string | null,
  items: ItemCarrito[],
  metodoEntrega: string,
  costoEnvio: number,
): Promise<string> {
  const huella = [
    usuarioId ?? email.toLowerCase(),
    metodoEntrega,
    costoEnvio,
    ...items.map((i) => `${i.productoId}:${i.cantidad}:${i.precio}`).sort(),
    Math.floor(Date.now() / (15 * 60 * 1000)),
  ].join('|');

  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(huella));
  const hex = [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `checkout_${hex.slice(0, 40)}`;
}
