import * as seed from '@/data/seed';
import { ErrorDeDatos, type FiltroProductos, type Repositorio } from './repositorio';
import type { Categoria, Pedido, Producto, Sucursal } from './types';

/*
 * Repositorio en memoria: el catálogo de muestra, sin base de datos detrás.
 *
 * Existe para poder enseñar el sitio desplegado antes de contratar Turso. Cumple
 * el mismo contrato que la implementación sobre libSQL, así que las páginas y
 * los endpoints no saben cuál de las dos tienen delante.
 *
 * Lo que se escriba aquí no dura: cada función serverless tiene su propia
 * memoria y se recicla sola, así que un producto creado desde el panel vive lo
 * que viva esa instancia. Para operar de verdad hace falta DATABASE_URL.
 */

const productos: Producto[] = seed.productos.map((p) => ({ ...p }));
const categorias: Categoria[] = seed.categorias.map((c) => ({ ...c }));
const sucursales: Sucursal[] = seed.sucursales.map((s) => ({ ...s }));
const pedidos: Pedido[] = [];
const eventos = new Set<string>();

const id = () => crypto.randomUUID();
const ahora = () => new Date().toISOString();

/** Una categoría incluye lo de sus subcategorías, igual que el CTE recursivo. */
function rama(slug: string): string[] {
  const raiz = categorias.find((c) => c.slug === slug);
  if (!raiz) return [];

  const ids = [raiz.id];
  for (const c of categorias) {
    // El árbol es de dos niveles, así que una pasada basta.
    if (c.padreId && ids.includes(c.padreId)) ids.push(c.id);
  }
  return ids;
}

export const memoria: Repositorio = {
  async listarProductos(filtro: FiltroProductos = {}) {
    let lista = productos.filter((p) => p.activo);

    if (filtro.categoriaSlug) {
      const ids = rama(filtro.categoriaSlug);
      // Si el slug no existe, no hay nada que devolver.
      lista = ids.length ? lista.filter((p) => ids.includes(p.categoriaId)) : [];
    }

    if (filtro.temporada !== undefined) lista = lista.filter((p) => p.temporada === filtro.temporada);
    if (filtro.destacado !== undefined) lista = lista.filter((p) => p.destacado === filtro.destacado);

    if (filtro.busqueda) {
      const q = filtro.busqueda.toLowerCase();
      lista = lista.filter((p) =>
        [p.nombre, p.descripcion, p.sku].some((campo) => campo.toLowerCase().includes(q)),
      );
    }

    const orden =
      filtro.orden === 'precio-asc' ? (a: Producto, b: Producto) => a.precio - b.precio
      : filtro.orden === 'precio-desc' ? (a: Producto, b: Producto) => b.precio - a.precio
      : (a: Producto, b: Producto) => b.creadoEn.localeCompare(a.creadoEn);

    lista = [...lista].sort(orden);
    return filtro.limite ? lista.slice(0, filtro.limite) : lista;
  },

  async obtenerProducto(slug) {
    return productos.find((p) => p.slug === slug) ?? null;
  },

  async obtenerProductoPorId(pid) {
    return productos.find((p) => p.id === pid) ?? null;
  },

  async crearProducto(datos) {
    if (productos.some((p) => p.slug === datos.slug)) {
      throw new ErrorDeDatos(`Ya hay un producto en /producto/${datos.slug}.`, 'conflicto');
    }
    if (productos.some((p) => p.sku === datos.sku)) {
      throw new ErrorDeDatos(`Ya hay un producto con el SKU ${datos.sku}.`, 'conflicto');
    }

    const nuevo: Producto = { ...datos, id: id(), creadoEn: ahora() };
    productos.push(nuevo);
    return nuevo;
  },

  async actualizarProducto(pid, datos) {
    const actual = productos.find((p) => p.id === pid);
    if (!actual) return null;

    if (datos.slug && productos.some((p) => p.slug === datos.slug && p.id !== pid)) {
      throw new ErrorDeDatos(`Ya hay un producto en /producto/${datos.slug}.`, 'conflicto');
    }
    if (datos.sku && productos.some((p) => p.sku === datos.sku && p.id !== pid)) {
      throw new ErrorDeDatos(`Ya hay un producto con el SKU ${datos.sku}.`, 'conflicto');
    }

    // El id y el alta no se tocan, vengan o no en los datos.
    Object.assign(actual, datos, { id: actual.id, creadoEn: actual.creadoEn });
    return actual;
  },

  async eliminarProducto(pid) {
    /* Un producto que ya está en pedidos no se borra: se oculta. Borrarlo
       dejaría notas de clientes apuntando a la nada. */
    const enUso = pedidos.some((o) => o.items.some((i) => i.productoId === pid));
    if (enUso) {
      const p = productos.find((x) => x.id === pid);
      if (p) p.activo = false;
      throw new ErrorDeDatos(
        'Ese producto aparece en pedidos, así que no se puede borrar. Lo ocultamos de la tienda.',
        'conflicto',
      );
    }

    const i = productos.findIndex((p) => p.id === pid);
    if (i === -1) return false;
    productos.splice(i, 1);
    return true;
  },

  async listarCategorias() {
    return [...categorias].sort((a, b) => a.orden - b.orden);
  },

  async crearCategoria(datos) {
    if (categorias.some((c) => c.slug === datos.slug)) {
      throw new ErrorDeDatos(`Ya existe una categoría en /tienda/${datos.slug}.`, 'conflicto');
    }
    const nueva: Categoria = { ...datos, id: id() };
    categorias.push(nueva);
    return nueva;
  },

  async eliminarCategoria(cid) {
    if (productos.some((p) => p.categoriaId === cid)) {
      throw new ErrorDeDatos('La categoría tiene productos asignados. Muévelos antes de eliminarla.', 'conflicto');
    }
    if (categorias.some((c) => c.padreId === cid)) {
      throw new ErrorDeDatos('La categoría tiene subcategorías. Elimínalas primero.', 'conflicto');
    }

    const i = categorias.findIndex((c) => c.id === cid);
    if (i === -1) return false;
    categorias.splice(i, 1);
    return true;
  },

  async listarSucursales() {
    return sucursales;
  },

  async crearPedido(pedido) {
    pedidos.push(pedido);
    return pedido;
  },

  async obtenerPedidoPorSesion(sessionId) {
    return pedidos.find((p) => p.stripeSessionId === sessionId) ?? null;
  },

  async listarPedidos(limite = 50) {
    return [...pedidos].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn)).slice(0, limite);
  },

  async listarPedidosDeUsuario(usuarioId) {
    return [...pedidos]
      .filter((p) => p.usuarioId === usuarioId)
      .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  },

  async asignarRol() {
    // Sin base no hay tabla de usuarios que actualizar.
    return false;
  },

  async marcarPagado({ sessionId, monto, paymentIntentId = null, direccion = null }) {
    const p = pedidos.find((x) => x.stripeSessionId === sessionId);
    if (!p) return null;

    // Evento repetido de Stripe, o el otro camino de confirmación llegó primero.
    if (p.estado !== 'pendiente_pago') return { pedido: p, primeraVez: false };

    p.pagado = monto;
    p.estado = 'pagado';
    p.stripePaymentIntentId = paymentIntentId;
    p.pagadoEn = ahora();
    if (direccion) p.direccion = { id: id(), ...direccion };

    // El inventario se descuenta al confirmar el cobro, nunca antes.
    for (const i of p.items) {
      const prod = productos.find((x) => x.id === i.productoId);
      if (prod) prod.stock = Math.max(0, prod.stock - i.cantidad);
    }

    return { pedido: p, primeraVez: true };
  },

  async cancelarPedidoPorSesion(sessionId) {
    const p = pedidos.find((x) => x.stripeSessionId === sessionId);
    // Un pedido ya cobrado no se cancela aunque llegue tarde el aviso.
    if (!p || p.estado !== 'pendiente_pago') return null;
    p.estado = 'cancelado';
    return p;
  },

  async registrarEvento(eventoId) {
    if (eventos.has(eventoId)) return false; // Stripe lo está reintentando
    eventos.add(eventoId);
    return true;
  },

  async olvidarEvento(eventoId) {
    eventos.delete(eventoId);
  },
};
