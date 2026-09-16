/** Modelo de dominio de Orta Novedades. Todos los importes en centavos MXN. */

export type Rol = 'admin' | 'cliente' | 'invitado';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  creadoEn: string;
}

export interface Categoria {
  id: string;
  slug: string;
  nombre: string;
  /** null en categorías raíz; el id de la madre en subcategorías */
  padreId: string | null;
  /** acento visual heredado por las tarjetas de la categoría */
  acento: 'cielo' | 'oro' | 'mistico' | 'tinta';
  orden: number;
  activa: boolean;
}

export interface Producto {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string;
  /** centavos MXN */
  precio: number;
  /** precio anterior, para temporada. null si no está en oferta */
  precioAnterior: number | null;
  sku: string;
  stock: number;
  categoriaId: string;
  imagenes: string[];
  temporada: boolean;
  destacado: boolean;
  activo: boolean;
  creadoEn: string;
}

export interface ItemCarrito {
  productoId: string;
  slug: string;
  nombre: string;
  precio: number;
  imagen: string;
  cantidad: number;
}

export type MetodoEntrega = 'envio' | 'pickup';

export interface Sucursal {
  id: string;
  nombre: string;
  direccion: string;
  horario: string;
  cp: string;
}

export interface OpcionEnvio {
  id: string;
  nombre: string;
  descripcion: string;
  /** centavos MXN */
  costo: number;
  diasHabiles: [number, number];
}

export type EstadoPedido =
  /**
   * Pedido de envío recibido y todavía sin precio de envío. No hay cobro
   * abierto: la tienda lleva los paquetes a la paquetería, y solo cuando sabe
   * cuánto cuesta genera el pago. Ver src/pages/api/admin/pedidos/[id]/cotizar.ts
   */
  | 'por_cotizar'
  | 'pendiente_pago'
  | 'pagado'
  | 'en_preparacion'
  | 'enviado'
  | 'listo_para_recoger'
  | 'entregado'
  | 'cancelado'
  /**
   * Se devolvió todo lo cobrado desde el panel de Stripe. Lo pone el webhook,
   * no el panel del sitio. Un reembolso parcial no cambia el estado: solo
   * suma en `reembolsado`.
   */
  | 'reembolsado';

export interface Pedido {
  id: string;
  folio: string;
  /** null en compras de invitado */
  usuarioId: string | null;
  emailContacto: string;
  items: ItemCarrito[];
  subtotal: number;
  envio: number;
  total: number;
  /** lo que Stripe confirmó cobrado. Un pedido pagado iguala a total */
  pagado: number;
  /**
   * Lo devuelto desde Stripe, acumulado. `pagado` no se toca al reembolsar: lo
   * que entró de verdad es `pagado - reembolsado`.
   */
  reembolsado: number;
  metodoEntrega: MetodoEntrega;
  sucursalId: string | null;
  direccion: Direccion | null;
  /**
   * Código postal de destino, capturado al solicitar el pedido.
   *
   * La dirección completa la sigue recogiendo Stripe al pagar, pero el pago se
   * abre después de cotizar, y para cotizar con la paquetería hace falta saber
   * a dónde va. De ahí este campo: null en los pedidos para recoger en tienda.
   */
  cpEntrega: string | null;
  estado: EstadoPedido;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  /** cuándo se confirmó el cobro. null mientras el pedido siga pendiente */
  pagadoEn: string | null;
  creadoEn: string;
}

export interface Direccion {
  id?: string;
  nombre: string;
  calle: string;
  numero: string;
  colonia: string;
  ciudad: string;
  estado: string;
  cp: string;
  telefono: string;
  referencias?: string;
}

/** Alguien que pidió los correos de novedades desde el pie de la tienda. */
export interface Suscriptor {
  id: string;
  email: string;
  /** Va en el enlace de baja: quien lo tiene puede darse de baja sin entrar. */
  token: string;
  creadoEn: string;
}
