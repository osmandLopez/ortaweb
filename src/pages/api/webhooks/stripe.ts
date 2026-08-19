import type { APIRoute } from 'astro';
import type Stripe from 'stripe';
import { stripeCliente } from '@/lib/stripe';
import { db } from '@/lib/db';
import { env } from '@/lib/entorno';
import { correoPedido, enviarCorreo } from '@/lib/correo';

export const prerender = false;

/*
 * Fuente de verdad del cobro.
 *
 * Nunca marques un pedido como pagado en la página de éxito: el cliente puede
 * cerrar la pestaña. Este webhook es lo único que cambia el estado del pedido,
 * descuenta inventario y manda la confirmación por correo.
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
     inventario y a mandar otro correo de confirmación. */
  const primeraVez = await db.registrarEvento(evento.id, evento.type);
  if (!primeraVez) {
    return new Response(JSON.stringify({ recibido: true, duplicado: true }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  switch (evento.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const sesion = evento.data.object;
      // `paid` es lo único que confirma el cobro: una sesión completada con
      // pago diferido llega aquí como `unpaid` y todavía no vale.
      if (sesion.payment_status !== 'paid') break;

      const intento = typeof sesion.payment_intent === 'string' ? sesion.payment_intent : null;
      const resultado = await db.marcarPagado(sesion.id, sesion.amount_total ?? 0, intento);
      if (!resultado) {
        // Cobro sin pedido: no se puede resolver reintentando, pero tiene que
        // quedar constancia para revisarlo a mano en el panel de Stripe.
        console.error(`[orta] Sesión ${sesion.id} pagada sin pedido asociado.`);
        break;
      }

      /* La segunda capa contra duplicados: aunque llegue otro evento distinto
         del mismo cobro (por ejemplo completed + async_payment_succeeded), el
         pedido ya está en 'pagado' y no se repite ni el correo ni el descuento
         de inventario. */
      if (!resultado.primeraVez) break;

      const sucursales = await db.listarSucursales();
      const sucursal = resultado.pedido.sucursalId
        ? sucursales.find((s) => s.id === resultado.pedido.sucursalId) ?? null
        : null;

      const envio = await enviarCorreo({
        para: resultado.pedido.emailContacto,
        ...correoPedido(resultado.pedido, sucursal),
      });
      /* Que falle el correo no puede tumbar el webhook: el pedido ya está
         pagado y devolver un error haría que Stripe reintentara el evento
         entero. Queda registrado para reenviarlo a mano. */
      if (!envio.ok) {
        console.error(`[orta] Pedido ${resultado.pedido.folio} sin correo de confirmación: ${envio.detalle}`);
      }
      break;
    }

    case 'checkout.session.expired': {
      // La sesión caducó sin pago. El pedido pendiente se queda como está: no
      // reservó inventario, así que no hay nada que liberar.
      break;
    }

    case 'charge.refunded': {
      // Reembolso total o parcial: se atiende desde el panel de Stripe.
      break;
    }
  }

  return new Response(JSON.stringify({ recibido: true }), {
    headers: { 'content-type': 'application/json' },
  });
};
