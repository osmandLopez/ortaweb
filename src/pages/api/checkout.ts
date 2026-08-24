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
      /* Una clave nueva por petición, no sacada del carrito.
         Derivarla del contenido —mismo cliente, mismo carrito, misma entrega—
         parecía proteger del doble clic, pero el cuerpo que acompaña a la clave
         nunca es igual dos veces: el folio se sortea de nuevo y `expires_at` se
         mueve con el reloj. Stripe entonces rechaza la repetición con «Keys for
         idempotent requests can only be used with the same parameters», que aquí
         se veía como "no pudimos abrir el pago". Le pasaba a cualquiera que
         volviera de Stripe y pulsara Pagar por segunda vez. */
      claveIdempotencia: crypto.randomUUID(),
    });
  } catch (e) {
    console.error(`[orta] No se pudo abrir la sesión de pago (${folio}):`, (e as Error).message);
    return json({ error: 'No pudimos abrir el pago ahora mismo. Inténtalo en un momento.' }, 502);
  }

  /* El SDK reintenta solo los fallos de red (maxNetworkRetries), y al reintentar
     reenvía la misma clave de idempotencia. Si la primera llamada sí llegó a
     Stripe y lo que se perdió fue la respuesta, el reintento devuelve la sesión
     que ya existía —y con ella, un pedido que ya guardamos—. Insertarlo otra vez
     chocaría contra el índice único de stripe_session_id y el cliente vería un
     500 por un problema de red que ya estaba resuelto. */
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
