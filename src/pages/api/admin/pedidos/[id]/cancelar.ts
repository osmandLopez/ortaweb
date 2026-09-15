import type { APIRoute } from 'astro';
import { db } from '@/lib/db';

export const prerender = false;

/*
 * Cierra un pedido que no se va a cobrar: el cliente no aceptó el costo del
 * envío, o se arrepintió antes de pagar.
 *
 * El repositorio solo deja cancelar lo que está sin cobrar. Un pedido pagado no
 * se toca desde aquí: eso es un reembolso y se hace en Stripe, donde el dinero
 * de verdad puede volver.
 */

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export const POST: APIRoute = async ({ params }) => {
  const pedido = await db.obtenerPedidoPorId(params.id!);
  if (!pedido) return json({ error: 'Ese pedido ya no existe.' }, 404);

  const cancelado = await db.cancelarPedido(pedido.id);

  if (!cancelado) {
    return json(
      {
        error:
          pedido.estado === 'pagado' || pedido.pagado > 0
            ? 'Este pedido ya está pagado: el reembolso se hace desde Stripe, no desde aquí.'
            : `Este pedido ya está como «${pedido.estado.replace(/_/g, ' ')}».`,
      },
      409,
    );
  }

  return json({ estado: cancelado.estado });
};
