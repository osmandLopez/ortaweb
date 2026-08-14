import type { Categoria, Pedido, Producto, Sucursal } from './types';

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
   * Registra el cobro y descuenta inventario en una sola transacción.
   * Devuelve null si la sesión no corresponde a ningún pedido.
   */
  marcarPagado(sessionId: string, monto: number, paymentIntentId?: string | null): Promise<Pedido | null>;

  /**
   * Idempotencia de webhooks. Devuelve true la primera vez que se ve un evento
   * y false si Stripe lo está reintentando, para no cobrar ni descontar dos veces.
   */
  registrarEvento(id: string, tipo: string): Promise<boolean>;
}

export interface FiltroProductos {
  categoriaSlug?: string;
  temporada?: boolean;
  apartable?: boolean;
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
