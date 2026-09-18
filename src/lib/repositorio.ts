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
  obtenerPedidoPorId(id: string): Promise<Pedido | null>;
  obtenerPedidoPorSesion(sessionId: string): Promise<Pedido | null>;
  listarPedidos(limite?: number): Promise<Pedido[]>;
  listarPedidosDeUsuario(usuarioId: string): Promise<Pedido[]>;

  /**
   * Fija el precio del envío de un pedido `por_cotizar` y le engancha el cobro
   * recién abierto, dejándolo en `pendiente_pago`.
   *
   * Solo toca pedidos en `por_cotizar`: así dos pestañas del panel cotizando el
   * mismo pedido no abren dos cobros, y uno ya pagado no se puede reabrir.
   * Devuelve el pedido actualizado, o null si ya no estaba por cotizar.
   */
  cotizarEnvio(datos: CotizacionEnvio): Promise<Pedido | null>;

  /**
   * Cancela un pedido por su id, desde el panel.
   *
   * Es la salida para cuando el cliente no acepta el costo del envío. Solo toca
   * pedidos sin cobrar —`por_cotizar` o `pendiente_pago`—; uno pagado se
   * reembolsa desde Stripe, no se cancela aquí.
   */
  cancelarPedido(id: string): Promise<Pedido | null>;

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
   * Cierra el cobro de un pedido que se quedó sin pagar: la sesión de Stripe
   * caducó, o el pago diferido (OXXO, transferencia) acabó rechazado.
   *
   * Qué pasa con el pedido depende de cómo se entrega, y la diferencia importa:
   *
   * - **Con envío, vuelve a `por_cotizar`.** Los enlaces de Stripe caducan a
   *   las 24 horas y ese es su máximo. Entre la cotización y el pago hay un
   *   correo y una espera humana —el cliente la ve al día siguiente, o el
   *   lunes—, así que cancelar al caducar le quitaría el pedido a quien todavía
   *   quería pagarlo. Volviendo a `por_cotizar`, el panel puede reenviarle el
   *   cobro con un botón.
   * - **Para recoger en tienda, se cancela.** Ahí el pago es inmediato: si la
   *   sesión caducó, la persona se fue del checkout y no va a volver.
   *
   * Solo toca pedidos en `pendiente_pago`; nunca uno cobrado. Devuelve el
   * pedido ya actualizado —su `estado` dice qué se hizo— o null si no había
   * nada que cambiar.
   */
  caducarPedidoPorSesion(sessionId: string): Promise<Pedido | null>;

  /**
   * Apunta en el pedido un reembolso hecho desde el panel de Stripe.
   *
   * - **Total:** el pedido pasa a `reembolsado` y lo que llevaba vuelve al
   *   inventario, porque ese stock se descontó al cobrar. Si alguna pieza
   *   regresa dañada, se corrige a mano en el producto.
   * - **Parcial:** solo se guarda el importe. El estado no cambia y el
   *   inventario tampoco: Stripe dice cuánto dinero volvió, no qué piezas.
   *
   * Es idempotente: `monto` es el acumulado del cargo, no el de este
   * reembolso, y el inventario solo se devuelve la vez que el pedido entra en
   * `reembolsado`. Devuelve null si el cargo no es de ningún pedido del sitio.
   */
  registrarReembolso(datos: Reembolso): Promise<{ pedido: Pedido; inventarioDevuelto: boolean } | null>;

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

/** Lo que dice Stripe de un cargo con reembolsos. */
export interface Reembolso {
  /** El cobro, tal como se guardó al confirmar el pago. */
  paymentIntentId: string | null;
  /** El folio que viaja en los metadatos del cobro: plan B si falta el anterior. */
  folio: string | null;
  /** Centavos devueltos hasta ahora en ese cargo, sumando todos los reembolsos. */
  monto: number;
  /** true cuando ya se devolvió el cargo entero. */
  completo: boolean;
}

export interface CotizacionEnvio {
  pedidoId: string;
  /** Centavos que cobra la paquetería, tal como los capturó el panel. */
  envio: number;
  /** La sesión de Checkout recién abierta con mercancía + envío. */
  sessionId: string;
}

export interface FiltroProductos {
  /**
   * Incluye los productos ocultos (`activo: false`). Solo el panel lo pide: la
   * tienda nunca debe enseñarlos. Sin esto, un producto que se oculta
   * desaparece también de la lista del panel y no hay forma de volver a
   * mostrarlo.
   */
  incluirOcultos?: boolean;
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
