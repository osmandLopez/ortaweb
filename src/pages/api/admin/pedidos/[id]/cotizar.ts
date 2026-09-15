import type { APIRoute } from 'astro';
import { z } from 'zod';
import { db } from '@/lib/db';
import { crearSesionCheckout } from '@/lib/stripe';
import { correoCotizado, enviarCorreo } from '@/lib/correo';
import { sitioUrl } from '@/lib/entorno';

export const prerender = false;

/*
 * Le pone precio al envío de un pedido y abre el cobro.
 *
 * Es el paso que sustituye a la tarifa automática: el dueño lleva los paquetes a
 * la paquetería, le dan el precio, lo escribe aquí, y hasta ese momento existe
 * algo que pagar. El middleware ya dejó fuera a quien no sea admin.
 *
 * El orden importa y no es casual:
 *
 *   1. Se abre la sesión en Stripe.
 *   2. Se guarda en el pedido (y solo si seguía `por_cotizar`).
 *   3. Se manda el correo.
 *
 * Si el paso 2 falla, la sesión queda huérfana en Stripe y nadie la ve: molesta,
 * pero no cobra. Al revés —guardar primero y abrir después— dejaría el pedido
 * diciendo "pendiente de pago" con un enlace que no existe.
 */

const schema = z.object({
  /* En pesos, como lo escribe el dueño; a centavos se pasa aquí. El tope no es
     por desconfianza: es la red que atrapa el dedo que teclea 15000 en vez de
     150 y le manda a un cliente un cobro absurdo. */
  envio: z.number().positive('El envío tiene que ser mayor a cero.').max(5000, 'Revisa el monto: ¿de verdad son más de $5,000 de envío?'),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export const POST: APIRoute = async ({ params, request, url }) => {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: parsed.error.issues[0]!.message }, 422);

  const centavos = Math.round(parsed.data.envio * 100);

  const pedido = await db.obtenerPedidoPorId(params.id!);
  if (!pedido) return json({ error: 'Ese pedido ya no existe.' }, 404);

  if (pedido.estado !== 'por_cotizar') {
    return json(
      { error: `Este pedido ya no está por cotizar (está como «${pedido.estado.replace(/_/g, ' ')}»).` },
      409,
    );
  }

  let sesion;
  try {
    sesion = await crearSesionCheckout({
      items: pedido.items,
      envio: {
        id: 'cotizado',
        nombre: 'Envío',
        descripcion: 'Cotizado con la paquetería para tu domicilio',
        costo: centavos,
        diasHabiles: [1, 7],
      },
      metodoEntrega: 'envio',
      sucursalId: null,
      email: pedido.emailContacto,
      folio: pedido.folio,
      usuarioId: pedido.usuarioId,
      origen: sitioUrl() || url.origin,
      /* Derivada del pedido y del monto: si el dueño pulsa dos veces con el
         mismo importe, Stripe devuelve la sesión que ya abrió en vez de una
         segunda. Con un monto distinto sí abre otra, que es lo que se quiere
         cuando corrige una cifra mal escrita. */
      claveIdempotencia: `cotiza-${pedido.id}-${centavos}`,
    });
  } catch (e) {
    console.error(`[orta] No se pudo abrir el cobro de ${pedido.folio}:`, (e as Error).message);
    return json({ error: 'Stripe no respondió. Inténtalo en un momento.' }, 502);
  }

  const actualizado = await db.cotizarEnvio({
    pedidoId: pedido.id,
    envio: centavos,
    sessionId: sesion.id,
  });

  /* Null aquí significa que alguien más lo cotizó entre la lectura y la
     escritura: dos pestañas del panel, o un doble clic que llegó por caminos
     distintos. La sesión recién abierta se queda sin usar y no se manda nada. */
  if (!actualizado) {
    return json({ error: 'Alguien acaba de cotizar este pedido. Recarga la página para ver cómo quedó.' }, 409);
  }

  const urlPago = sesion.url ?? '';

  /* El correo se intenta, pero el enlace se devuelve siempre: si Resend falla,
     el dueño todavía puede pegárselo al cliente por WhatsApp. Por eso la
     pantalla lo muestra en vez de darlo por enviado y esconderlo. */
  const aviso = await enviarCorreo({
    para: actualizado.emailContacto,
    ...correoCotizado(actualizado, urlPago),
  });

  if (!aviso.ok) {
    console.error(`[orta] Cotización ${actualizado.folio} sin correo: ${aviso.detalle}`);
  }

  return json({
    url: urlPago,
    correoEnviado: aviso.ok,
    total: actualizado.total,
    envio: actualizado.envio,
  });
};
