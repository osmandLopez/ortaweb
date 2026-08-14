import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import { stripeCliente } from '@/lib/stripe';
import { db } from '@/lib/db';
import { env } from '@/lib/entorno';

export const prerender = false;

/*
 * Fuente de verdad del cobro.
 *
 * Nunca marques un pedido como pagado en la página de éxito: el cliente puede
 * cerrar la pestaña. Este webhook es lo único que cambia el estado del pedido
 * y descuenta inventario.
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
    evento = stripeCliente().webhooks.constructEvent(await request.text(), firma, secreto);
  } catch (e) {
    return new Response(`Firma inválida: ${(e as Error).message}`, { status: 400 });
  }

  /* Stripe reintenta hasta que respondemos 2xx, y a veces entrega el mismo
     evento dos veces. Sin esta guarda, un reintento volvería a descontar
     inventario y a registrar un abono duplicado. */
  const primeraVez = await db.registrarEvento(evento.id, evento.type);
  if (!primeraVez) {
    return new Response(JSON.stringify({ recibido: true, duplicado: true }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  switch (evento.type) {
    case 'checkout.session.completed': {
      const sesion = evento.data.object;
      if (sesion.payment_status === 'paid') {
        const intento = typeof sesion.payment_intent === 'string' ? sesion.payment_intent : null;
        await db.marcarPagado(sesion.id, sesion.amount_total ?? 0, intento);
        // Aquí van los efectos: correo de confirmación con la nota de apartado,
        // aviso a la sucursal si el método fue pickup, alta en la cola de envío.
      }
      break;
    }

    case 'checkout.session.expired': {
      // La sesión caducó sin pago: el pedido pendiente puede liberarse.
      break;
    }

    case 'charge.refunded': {
      // Reembolso total o parcial de un abono.
      break;
    }
  }

  return new Response(JSON.stringify({ recibido: true }), {
    headers: { 'content-type': 'application/json' },
  });
};
