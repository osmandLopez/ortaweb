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
  /** admite reserva con anticipo */
  apartable: boolean;
  /** porcentaje mínimo de anticipo, 0–100. Solo aplica si apartable */
  anticipoMinimo: number;
  /** semanas para liquidar el apartado */
  plazoSemanas: number;
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
  /** 'compra' cobra el total; 'apartado' cobra solo el anticipo */
  modo: 'compra' | 'apartado';
  anticipo: number;
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
  | 'pendiente_pago'
  | 'pagado'
  | 'apartado_activo'
  | 'apartado_liquidado'
  | 'en_preparacion'
  | 'enviado'
  | 'listo_para_recoger'
  | 'entregado'
  | 'cancelado';

export interface Abono {
  id: string;
  pedidoId: string;
  monto: number;
  fecha: string;
  stripePaymentIntentId: string | null;
}

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
  /** suma de abonos cobrados; en compras normales iguala a total */
  pagado: number;
  metodoEntrega: MetodoEntrega;
  sucursalId: string | null;
  direccion: Direccion | null;
  estado: EstadoPedido;
  esApartado: boolean;
  venceEn: string | null;
  stripeSessionId: string | null;
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
