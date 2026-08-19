import Stripe from 'stripe';
import { env } from './entorno';
import type { ItemCarrito, MetodoEntrega, OpcionEnvio } from './types';

/*
 * El cliente se arma en la primera llamada, no al importar el módulo.
 *
 * Construirlo arriba hacía que una clave ausente reventara al cargar el módulo,
 * y en una función serverless eso es un 500 con el cuerpo vacío en la ruta
 * entera: sin traza, sin pista de qué falta. Así el fallo llega solo a quien
 * usa Stripe y dice qué variable falta.
 */
let cliente: Stripe | null = null;

export function stripeCliente(): Stripe {
  if (cliente) return cliente;

  const clave = env('STRIPE_SECRET_KEY');
  if (!clave) {
    throw new Error(
      'Falta STRIPE_SECRET_KEY. Defínela en .env para desarrollo, o en las ' +
        'variables de entorno del proyecto en Vercel para el sitio publicado.',
    );
  }

  cliente = new Stripe(clave, {
    // Fijada a propósito: la versión que espera el SDK instalado (stripe 17.7).
    apiVersion: '2025-02-24.acacia',
    appInfo: { name: 'Orta Novedades', version: '0.1.0' },
  });
  return cliente;
}

export const MONEDA = 'mxn';

/**
 * Convierte el carrito en line_items de Stripe.
 *
 * Los importes que llegan aquí ya vienen releídos de la base en /api/checkout:
 * nada de lo que mande el navegador entra en el cobro.
 */
export function lineItems(items: ItemCarrito[]): Stripe.Checkout.SessionCreateParams.LineItem[] {
  return items.map((item) => ({
    quantity: item.cantidad,
    price_data: {
      currency: MONEDA,
      unit_amount: item.precio,
      product_data: {
        name: item.nombre,
        metadata: { producto_id: item.productoId },
      },
    },
  }));
}

export function lineItemEnvio(opcion: OpcionEnvio): Stripe.Checkout.SessionCreateParams.LineItem {
  return {
    quantity: 1,
    price_data: {
      currency: MONEDA,
      unit_amount: opcion.costo,
      product_data: { name: `Envío · ${opcion.nombre}`, description: opcion.descripcion },
    },
  };
}

export interface DatosSesion {
  items: ItemCarrito[];
  envio: OpcionEnvio | null;
  metodoEntrega: MetodoEntrega;
  sucursalId: string | null;
  email: string;
  folio: string;
  usuarioId: string | null;
  origen: string;
}

export function crearSesionCheckout(datos: DatosSesion) {
  const items = [...lineItems(datos.items)];
  if (datos.envio && datos.envio.costo > 0) items.push(lineItemEnvio(datos.envio));

  return stripeCliente().checkout.sessions.create({
    mode: 'payment',
    /* Sin `payment_method_types`: Stripe usa los métodos activados en el panel
       y enseña a cada cliente los que puede pagar. Tarjeta (crédito y débito) va
       siempre; Apple Pay y Google Pay aparecen solos en cuanto el dominio está
       verificado en Stripe y el navegador los soporta. Fijar la lista a mano los
       apagaría. */
    line_items: items,
    customer_email: datos.email || undefined,
    locale: 'es-419',
    client_reference_id: datos.folio,
    success_url: `${datos.origen}/checkout/exito?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${datos.origen}/checkout?cancelado=1`,
    // El billing address se pide siempre; el shipping solo cuando hay envío.
    billing_address_collection: 'auto',
    shipping_address_collection:
      datos.metodoEntrega === 'envio' ? { allowed_countries: ['MX'] } : undefined,
    automatic_tax: { enabled: false },
    metadata: {
      folio: datos.folio,
      metodo_entrega: datos.metodoEntrega,
      sucursal_id: datos.sucursalId ?? '',
      usuario_id: datos.usuarioId ?? '',
    },
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  });
}
