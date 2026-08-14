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
    apiVersion: '2024-12-18.acacia',
    appInfo: { name: 'Orta Novedades', version: '0.1.0' },
  });
  return cliente;
}

export const MONEDA = 'mxn';

/**
 * Convierte el carrito en line_items de Stripe.
 *
 * Regla del negocio: un ítem en modo `apartado` cobra únicamente el anticipo en
 * esta sesión. El resto se liquida con abonos posteriores, cada uno su propio
 * PaymentIntent contra el mismo pedido.
 */
export function lineItems(items: ItemCarrito[]): Stripe.Checkout.SessionCreateParams.LineItem[] {
  return items.map((item) => {
    const esApartado = item.modo === 'apartado';
    const unitario = esApartado ? item.anticipo : item.precio;
    return {
      quantity: item.cantidad,
      price_data: {
        currency: MONEDA,
        unit_amount: unitario,
        product_data: {
          name: esApartado ? `Apartado · ${item.nombre}` : item.nombre,
          description: esApartado
            ? `Anticipo. Saldo por liquidar: ${((item.precio - item.anticipo) / 100).toFixed(2)} MXN`
            : undefined,
          metadata: { producto_id: item.productoId, modo: item.modo },
        },
      },
    };
  });
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
  const contieneApartado = datos.items.some((i) => i.modo === 'apartado');
  const items = [...lineItems(datos.items)];
  if (datos.envio && datos.envio.costo > 0) items.push(lineItemEnvio(datos.envio));

  return stripeCliente().checkout.sessions.create({
    mode: 'payment',
    // Tarjeta cubre crédito y débito. Apple Pay y Google Pay se activan solos en
    // Checkout cuando el dominio está verificado en el panel de Stripe.
    payment_method_types: ['card'],
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
      tipo: contieneApartado ? 'apartado' : 'compra',
    },
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  });
}
