import type { Categoria, Direccion, Pedido, Producto, Sucursal } from './types';

/**
 * Contrato de datos. Las páginas y las rutas de API solo hablan con esta
 * interfaz, así que cambiar de motor no toca componentes ni endpoints.
 */
export interface Repositorio {
  listarProductos(filtro?: FiltroProductos): Promise<Producto[]>;
  obtenerProducto(slug: string): Promise<Producto | null>;
  obtenerProductoPorId(id: string): Promise<Producto | null>;
  crearProducto(datos: Omit<Producto, 'id' | 'creadoEn'>): Promise<Producto>;
  actualizarProducto(id: string, datos: Partial<Producto>): Promise<Producto | null>;
  eliminarProducto(id: string): Promise<boolean>;

  listarCategorias(): Promise<Categoria[]>;
  crearCategoria(datos: Omit<Categoria, 'id'>): Promise<Categoria>;
  eliminarCategoria(id: string): Promise<boolean>;

  listarSucursales(): Promise<Sucursal[]>;

  crearPedido(pedido: Pedido): Promise<Pedido>;
  obtenerPedidoPorSesion(sessionId: string): Promise<Pedido | null>;
  listarPedidos(limite?: number): Promise<Pedido[]>;
  listarPedidosDeUsuario(usuarioId: string): Promise<Pedido[]>;

  /** Asigna el rol. Se usa desde el script de mantenimiento, no desde la web. */
  asignarRol(email: string, rol: 'admin' | 'cliente'): Promise<boolean>;

  /**
   * Confirma el cobro, guarda la dirección de entrega y descuenta inventario en
   * una sola transacción.
   *
   * Devuelve null si la sesión no corresponde a ningún pedido, y `primeraVez`
   * en false si el pedido ya estaba pagado: así quien la llama sabe que no debe
   * repetir los efectos (correo de confirmación, inventario) cuando Stripe
   * reintenta, cuando manda dos eventos del mismo cobro, o cuando el webhook y
   * la página de retorno confirman el mismo pedido a la vez.
   */
  marcarPagado(datos: ConfirmacionPago): Promise<{ pedido: Pedido; primeraVez: boolean } | null>;

  /**
   * Cierra un pedido que se quedó sin pagar: la sesión de Stripe caducó, o el
   * pago diferido (OXXO, transferencia) acabó rechazado.
   *
   * Solo toca pedidos en `pendiente_pago`; nunca puede cancelar uno cobrado.
   * Devuelve el pedido si lo cambió, y null si no había nada que cambiar.
   */
  cancelarPedidoPorSesion(sessionId: string): Promise<Pedido | null>;

  /**
   * Idempotencia de webhooks. Devuelve true la primera vez que se ve un evento
   * y false si Stripe lo está reintentando, para no cobrar ni descontar dos veces.
   */
  registrarEvento(id: string, tipo: string): Promise<boolean>;

  /**
   * Deshace `registrarEvento`. Se llama cuando el evento quedó a medio procesar:
   * la marca de "ya visto" solo debe sobrevivir si el trabajo llegó al final, o
   * el reintento de Stripe se descartaría como duplicado y el cobro se perdería.
   */
  olvidarEvento(id: string): Promise<void>;
}

/** Lo que se sabe del cobro una vez Stripe lo confirma. */
export interface ConfirmacionPago {
  /** La sesión de Checkout: es la que ata el cobro con el pedido. */
  sessionId: string;
  /** Centavos que Stripe dice haber cobrado. No se calcula aquí: se copia. */
  monto: number;
  /** Referencia del cargo en el panel de Stripe, para conciliar y reembolsar. */
  paymentIntentId?: string | null;
  /** Dirección capturada en el checkout. null en pedidos para recoger en tienda. */
  direccion?: Direccion | null;
}

export interface FiltroProductos {
  categoriaSlug?: string;
  temporada?: boolean;
  destacado?: boolean;
  busqueda?: string;
  orden?: 'reciente' | 'precio-asc' | 'precio-desc';
  limite?: number;
}

/** Error de negocio: el llamador puede mostrarlo al usuario tal cual. */
export class ErrorDeDatos extends Error {
  constructor(mensaje: string, readonly codigo: 'conflicto' | 'no_encontrado' | 'invalido' = 'invalido') {
    super(mensaje);
    this.name = 'ErrorDeDatos';
  }
}
