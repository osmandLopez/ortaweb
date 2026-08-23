import { db } from './db';
import { correoPedido, enviarCorreo } from './correo';
import { direccionDeSesion, idDelCobro, obtenerSesionCheckout } from './stripe';
import type { Pedido } from './types';

/*
 * Qué pasa cuando un pago se confirma. Un solo sitio, dos puertas.
 *
 * Stripe recomienda cumplir el pedido por los dos caminos, y hace falta:
 *
 *   · El webhook es el que manda. Llega aunque el cliente cierre la pestaña al
 *     salir de Stripe, que es exactamente cuando más falta hace.
 *   · La página de retorno cubre el hueco de los primeros segundos. El webhook
 *     tarda lo que tarde, y mientras tanto el cliente ya está mirando la
 *     pantalla de "gracias por tu compra" preguntándose si le cobraron.
 *
 * Los dos entran por aquí, así que da igual quién llegue primero: el segundo se
 * encuentra el pedido ya confirmado y no repite ni el correo ni el descuento de
 * inventario. El candado está en la base (marcarPagado), no en esta función.
 */

export type ResultadoCumplimiento =
  /** Se confirmó ahora mismo: se descontó inventario y salió el correo. */
  | { estado: 'cumplido'; pedido: Pedido }
  /** Ya estaba confirmado por el otro camino. No se repitió nada. */
  | { estado: 'ya_cumplido'; pedido: Pedido }
  /** Stripe todavía no ha cobrado (pago diferido, o sesión abandonada). */
  | { estado: 'sin_pagar'; pedido: Pedido | null }
  /** Hay cobro pero ningún pedido con esa sesión. Requiere mirarlo a mano. */
  | { estado: 'sin_pedido' };

/**
 * Confirma el pedido de una sesión de Checkout.
 *
 * El estado del cobro se relee de Stripe SIEMPRE, nunca se toma del cuerpo del
 * evento ni de la URL de retorno: es la única forma de que un `session_id`
 * escrito a mano en la barra de direcciones no pueda dar nada por pagado.
 *
 * Lanza si la base falla. Quien llama decide qué hacer con eso: el webhook
 * responde 500 para que Stripe reintente, la página de retorno enseña
 * "estamos confirmando".
 */
export async function cumplirPedido(sessionId: string): Promise<ResultadoCumplimiento> {
  const sesion = await obtenerSesionCheckout(sessionId);

  /* `paid` es lo único que confirma el cobro. Una sesión completada con pago
     diferido (OXXO, transferencia) llega como `unpaid` y todavía no vale: el
     dinero puede no aparecer nunca. */
  if (sesion.payment_status !== 'paid') {
    return { estado: 'sin_pagar', pedido: await db.obtenerPedidoPorSesion(sesion.id) };
  }

  const resultado = await db.marcarPagado({
    sessionId: sesion.id,
    // El importe es el que dice Stripe, no el que calculamos: es el que se cobró.
    monto: sesion.amount_total ?? 0,
    paymentIntentId: idDelCobro(sesion),
    direccion: direccionDeSesion(sesion),
  });

  if (!resultado) {
    /* Cobro sin pedido. No se arregla reintentando —el pedido no va a
       aparecer— pero tiene que quedar constancia para devolver el dinero o
       levantar la nota a mano desde el panel de Stripe. */
    console.error(
      `[orta] Sesión ${sesion.id} pagada sin pedido asociado. ` +
        `Folio esperado: ${sesion.client_reference_id ?? '(ninguno)'}. Revisar a mano.`,
    );
    return { estado: 'sin_pedido' };
  }

  if (!resultado.primeraVez) return { estado: 'ya_cumplido', pedido: resultado.pedido };

  const pedido = resultado.pedido;

  /* El total ya se validó al abrir la sesión, así que esto no debería pasar
     nunca. Si pasa, el pedido se respeta —el dinero está cobrado— pero se deja
     escrito: significa que alguien cambió el precio del catálogo mientras el
     cliente pagaba, o que se tocó la sesión desde el panel. */
  if (pedido.pagado !== pedido.total) {
    console.error(
      `[orta] Pedido ${pedido.folio}: Stripe cobró ${pedido.pagado} y la nota decía ${pedido.total}.`,
    );
  }

  await avisarAlCliente(pedido);
  return { estado: 'cumplido', pedido };
}

/**
 * El correo de confirmación. Nunca puede tumbar el cumplimiento.
 *
 * El pedido ya está cobrado y guardado cuando esto corre. Si Resend falla y
 * dejáramos subir el error, el webhook devolvería 500, Stripe reintentaría el
 * evento y el cliente acabaría con un pedido correcto y varios correos —o con
 * el webhook marcado en rojo en el panel por algo que no tiene que ver con el
 * pago. Se registra y se sigue.
 */
async function avisarAlCliente(pedido: Pedido): Promise<void> {
  try {
    const sucursales = await db.listarSucursales();
    const sucursal = pedido.sucursalId
      ? sucursales.find((s) => s.id === pedido.sucursalId) ?? null
      : null;

    const envio = await enviarCorreo({
      para: pedido.emailContacto,
      ...correoPedido(pedido, sucursal),
    });

    if (!envio.ok) {
      console.error(`[orta] Pedido ${pedido.folio} sin correo de confirmación: ${envio.detalle}`);
    }
  } catch (e) {
    console.error(`[orta] Pedido ${pedido.folio}: falló el aviso al cliente: ${(e as Error).message}`);
  }
}
