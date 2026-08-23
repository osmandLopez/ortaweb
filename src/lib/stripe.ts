import Stripe from 'stripe';
import { env } from './entorno';
import type { Direccion, ItemCarrito, MetodoEntrega, OpcionEnvio } from './types';

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
    /* Stripe reintenta solo los fallos de red y los 5xx, y solo si la llamada
       lleva clave de idempotencia (todas las de aquí la llevan). Sin esto, un
       corte de un segundo en una función serverless se le presenta al cliente
       como "no pudimos abrir el pago". */
    maxNetworkRetries: 2,
  });
  return cliente;
}

export const MONEDA = 'mxn';

/** true si la clave configurada es de modo Test. Se usa en los diagnósticos. */
export function enModoPrueba(): boolean {
  return (env('STRIPE_SECRET_KEY') ?? '').startsWith('sk_test_');
}

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
  /**
   * Identifica el intento de compra. Si la misma petición se repite —doble clic,
   * reintento del navegador, reintento de la red— Stripe devuelve la sesión que
   * ya creó en vez de abrir una segunda y cobrar dos veces.
   */
  claveIdempotencia: string;
}

export function crearSesionCheckout(datos: DatosSesion) {
  const items = [...lineItems(datos.items)];
  if (datos.envio && datos.envio.costo > 0) items.push(lineItemEnvio(datos.envio));

  const conEnvio = datos.metodoEntrega === 'envio';

  return stripeCliente().checkout.sessions.create(
    {
      mode: 'payment',
      /* Sin `payment_method_types`: Stripe usa los métodos activados en el panel
         y enseña a cada cliente los que puede pagar. Tarjeta (crédito y débito) va
         siempre; Apple Pay y Google Pay aparecen solos en cuanto el dominio está
         verificado en Stripe y el navegador los soporta. Fijar la lista a mano los
         apagaría. */
      line_items: items,
      customer_email: datos.email || undefined,
      locale: 'es-419',
      submit_type: 'pay',
      client_reference_id: datos.folio,
      success_url: `${datos.origen}/checkout/exito?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${datos.origen}/checkout?cancelado=1`,
      // El billing address se pide siempre; el shipping solo cuando hay envío.
      billing_address_collection: 'auto',
      shipping_address_collection: conEnvio ? { allowed_countries: ['MX'] } : undefined,
      // La paquetería pide teléfono de contacto; para recoger en tienda, no.
      phone_number_collection: { enabled: conEnvio },
      automatic_tax: { enabled: false },
      metadata: {
        folio: datos.folio,
        metodo_entrega: datos.metodoEntrega,
        sucursal_id: datos.sucursalId ?? '',
        usuario_id: datos.usuarioId ?? '',
      },
      /* El folio también en el cobro, no solo en la sesión: en el panel de Stripe
         las sesiones caducan de la vista a los 30 días, pero el pago y su
         reembolso se consultan siempre. Sin esto, conciliar un cargo con una nota
         obliga a cruzar importes y horas a mano. */
      payment_intent_data: {
        description: `Pedido ${datos.folio} · Orta Novedades`,
        metadata: { folio: datos.folio, usuario_id: datos.usuarioId ?? '' },
      },
      /* Una hora. El mínimo que acepta Stripe son 30 minutos *estrictos*: poner
         exactamente 1800 segundos hacía que la petición llegara con el margen ya
         consumido por la latencia y la rechazara con `expires_at must be at
         least 30 minutes in the future`. */
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    },
    { idempotencyKey: datos.claveIdempotencia },
  );
}

/**
 * Relee la sesión desde Stripe. Es la única fuente aceptable del estado del
 * cobro cuando el dato viene del navegador (la página de retorno recibe el
 * session_id en la URL, y una URL la escribe cualquiera).
 */
export function obtenerSesionCheckout(sessionId: string) {
  return stripeCliente().checkout.sessions.retrieve(sessionId);
}

/**
 * Pasa la dirección que capturó Stripe al modelo de la tienda.
 *
 * Devuelve null cuando la sesión no trae envío (recoger en tienda) o cuando
 * Stripe todavía no la tiene. En México el número va dentro de la primera línea
 * de la calle, así que no se intenta separar: se guarda tal como lo escribió el
 * cliente y `numero` queda vacío.
 */
export function direccionDeSesion(sesion: Stripe.Checkout.Session): Direccion | null {
  /* `collected_information` es donde vive desde la versión 2025-02-24; el campo
     `shipping_details` de arriba sigue existiendo por compatibilidad y se
     consulta como respaldo. */
  const envio = sesion.collected_information?.shipping_details ?? sesion.shipping_details;
  const dir = envio?.address;
  if (!dir?.line1) return null;

  return {
    nombre: envio?.name ?? '',
    calle: dir.line1,
    numero: '',
    colonia: dir.line2 ?? '',
    ciudad: dir.city ?? '',
    estado: dir.state ?? '',
    cp: dir.postal_code ?? '',
    telefono: sesion.customer_details?.phone ?? envio?.phone ?? '',
  };
}

/** El id del cobro, venga como cadena o como objeto expandido. */
export function idDelCobro(sesion: Stripe.Checkout.Session): string | null {
  const pi = sesion.payment_intent;
  if (!pi) return null;
  return typeof pi === 'string' ? pi : pi.id;
}
