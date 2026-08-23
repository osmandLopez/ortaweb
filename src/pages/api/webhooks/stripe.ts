import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import { stripeCliente } from '@/lib/stripe';
import { cumplirPedido } from '@/lib/cumplimiento';
import { db } from '@/lib/db';
import { env } from '@/lib/entorno';

export const prerender = false;

/*
 * Fuente de verdad del cobro.
 *
 * Nunca marques un pedido como pagado por lo que diga el navegador: el cliente
 * puede cerrar la pestaña al salir de Stripe, y una URL de retorno la escribe
 * cualquiera. Este webhook es el camino que siempre llega.
 *
 * El trabajo de verdad está en src/lib/cumplimiento.ts, compartido con la
 * página de retorno. Aquí solo se comprueba que el aviso viene de Stripe y se
 * decide qué evento merece atención.
 *
 * En local:  npm run stripe:listen
 */
export const POST: APIRoute = async ({ request }) => {
  const firma = request.headers.get('stripe-signature');
  if (!firma) return new Response('Falta la firma de Stripe.', { status: 400 });

  const secreto = env('STRIPE_WEBHOOK_SECRET');
  if (!secreto) {
    /* Sin el secreto no se puede validar la firma, y dar por buena la petición
       dejaría que cualquiera marcara pedidos como pagados. */
    return new Response('Falta STRIPE_WEBHOOK_SECRET en el servidor.', { status: 500 });
  }

  let evento: Stripe.Event;
  try {
    /* El cuerpo se lee en crudo y sin tocar: la firma se calcula sobre esos
       bytes exactos, así que parsear el JSON antes rompería la comprobación.
       constructEventAsync (y no la versión síncrona) porque usa WebCrypto, que
       es lo único disponible si algún día esta ruta corre en el runtime edge. */
    evento = await stripeCliente().webhooks.constructEventAsync(
      await request.text(),
      firma,
      secreto,
    );
  } catch (e) {
    return new Response(`Firma inválida: ${(e as Error).message}`, { status: 400 });
  }

  /* Stripe reintenta hasta que respondemos 2xx, y a veces entrega el mismo
     evento dos veces a la vez. Sin esta guarda, un reintento volvería a
     descontar inventario y a mandar otro correo de confirmación. */
  const primeraVez = await db.registrarEvento(evento.id, evento.type);
  if (!primeraVez) return ok({ duplicado: true });

  try {
    await atender(evento);
  } catch (e) {
    /* La marca de "ya visto" solo vale si el trabajo llegó al final. Dejarla
       puesta tras un fallo haría que el reintento de Stripe se descartara como
       duplicado y el pedido se quedara sin confirmar para siempre, con el
       dinero ya cobrado. Se borra y se devuelve 500 para que Stripe reintente:
       lo hace durante 3 días, con espera creciente. */
    await db.olvidarEvento(evento.id).catch(() => {});
    console.error(`[orta] Webhook ${evento.type} (${evento.id}) falló:`, (e as Error).message);
    return new Response('Error al procesar el evento. Reintenta.', { status: 500 });
  }

  return ok({});
};

async function atender(evento: Stripe.Event): Promise<void> {
  switch (evento.type) {
    /* El cobro salió bien. `completed` es el caso normal (tarjeta);
       `async_payment_succeeded` es el dinero que aparece días después en un pago
       diferido, y para entonces `completed` ya pasó por aquí sin cobrar nada. */
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const resultado = await cumplirPedido(evento.data.object.id);
      if (resultado.estado === 'cumplido') {
        console.log(`[orta] Pedido ${resultado.pedido.folio} confirmado por webhook.`);
      }
      break;
    }

    /* La sesión caducó sin pagar, o el pago diferido acabó rechazado. En los dos
       casos el pedido pendiente ya no va a cobrarse nunca: se cierra para que no
       se quede colgado en el panel fingiendo que alguien está a punto de pagar.
       No hay inventario que liberar, porque no se reservó nada: el stock se
       descuenta al confirmar el cobro, no antes. */
    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed': {
      const pedido = await db.cancelarPedidoPorSesion(evento.data.object.id);
      if (pedido) console.log(`[orta] Pedido ${pedido.folio} cancelado (${evento.type}).`);
      break;
    }

    /* Los rechazos de tarjeta no llegan aquí y no hacen falta: pasan dentro del
       formulario de Stripe, que enseña el motivo y deja al cliente reintentar
       sin salir. El pedido sigue pendiente hasta que pague o caduque la sesión.
       Este evento se registra solo para poder mirarlo en los logs. */
    case 'payment_intent.payment_failed': {
      const intento = evento.data.object;
      console.warn(
        `[orta] Pago rechazado (${intento.metadata?.folio ?? 'sin folio'}): ` +
          `${intento.last_payment_error?.message ?? 'sin detalle'}`,
      );
      break;
    }

    /* Reembolso total o parcial. Se hace desde el panel de Stripe y no cambia el
       estado del pedido por sí solo: devolver el dinero y cancelar el envío son
       decisiones distintas, y la segunda la toma la tienda. */
    case 'charge.refunded': {
      const cargo = evento.data.object;
      console.warn(
        `[orta] Reembolso de ${cargo.amount_refunded} en ${cargo.payment_intent} ` +
          `(folio ${cargo.metadata?.folio ?? 'desconocido'}). Ajusta el pedido a mano si toca.`,
      );
      break;
    }
  }
}

const ok = (extra: Record<string, unknown>) =>
  new Response(JSON.stringify({ recibido: true, ...extra }), {
    headers: { 'content-type': 'application/json' },
  });
