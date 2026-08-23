import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { and, asc, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import * as t from './schema';
import { ErrorDeDatos, type FiltroProductos, type Repositorio } from './repositorio';
import { tokenBaseDeDatos, urlBaseDeDatos } from './entorno';
import type { Categoria, ItemCarrito, Pedido, Producto, Sucursal } from './types';

/*
 * Implementación sobre libSQL: archivo local en desarrollo, Turso en producción.
 * El mismo cliente sirve para ambos; solo cambia DATABASE_URL.
 */
const urlBase = urlBaseDeDatos;

/*
 * Qué controlador se carga depende de a dónde apunta la base.
 *
 * `drizzle-orm/libsql` a secas importa el cliente de Node, y ese arrastra un
 * binario nativo (@libsql/<plataforma>/index.node) que el empaquetador de Vercel
 * no copia dentro de la función: deja el package.json y se deja el .node fuera.
 * El require falla al cargar el módulo, y como el middleware toca esta capa en
 * cada petición, el sitio entero responde 500 con el cuerpo vacío aunque el
 * build haya salido bien.
 *
 * La entrada /web habla con Turso por HTTP y no depende de nada nativo, así que
 * es la que sirve en producción. El binario solo hace falta para abrir el
 * archivo SQLite de desarrollo, y por eso las dos importaciones son dinámicas:
 * una estática volvería a meter el binario en el paquete.
 */
const esRemota = !urlBase.startsWith('file:');

const { drizzle } = esRemota
  ? await import('drizzle-orm/libsql/web')
  : await import('drizzle-orm/libsql/node');

export const orm = drizzle({
  connection: { url: urlBase, authToken: tokenBaseDeDatos() },
  schema: t,
}) as LibSQLDatabase<typeof t>;

const id = () => crypto.randomUUID();
const ahora = () => new Date().toISOString();

/* --- Traducción entre fila y modelo de dominio ------------------------- */

type FilaProducto = typeof t.productos.$inferSelect;

function aProducto(f: FilaProducto): Producto {
  return {
    id: f.id,
    slug: f.slug,
    nombre: f.nombre,
    descripcion: f.descripcion,
    sku: f.sku,
    precio: f.precio,
    precioAnterior: f.precioAnterior,
    stock: f.stock,
    categoriaId: f.categoriaId,
    imagenes: JSON.parse(f.imagenes) as string[],
    temporada: f.temporada,
    destacado: f.destacado,
    activo: f.activo,
    creadoEn: f.creadoEn,
  };
}

/** Las columnas que difieren del modelo se traducen aquí, el resto pasa igual. */
function aFilaProducto(p: Partial<Producto>) {
  const { imagenes, ...resto } = p;
  return imagenes ? { ...resto, imagenes: JSON.stringify(imagenes) } : resto;
}

/* --- Repositorio ------------------------------------------------------- */

export const sqlite: Repositorio = {
  async listarProductos(filtro: FiltroProductos = {}) {
    const donde = [eq(t.productos.activo, true)];

    if (filtro.categoriaSlug) {
      /* Una categoría incluye lo de sus subcategorías. El CTE recursivo resuelve
         el árbol dentro de la base en vez de traerlo entero a memoria. */
      const rama = await orm.all<{ id: string }>(sql`
        with recursive rama(id) as (
          select id from categorias where slug = ${filtro.categoriaSlug}
          union
          select c.id from categorias c join rama r on c.padre_id = r.id
        )
        select id from rama
      `);
      // Si el slug no existe, no hay nada que devolver.
      donde.push(rama.length ? inArray(t.productos.categoriaId, rama.map((r) => r.id)) : sql`0 = 1`);
    }

    if (filtro.temporada !== undefined) donde.push(eq(t.productos.temporada, filtro.temporada));
    if (filtro.destacado !== undefined) donde.push(eq(t.productos.destacado, filtro.destacado));

    if (filtro.busqueda) {
      const q = `%${filtro.busqueda.toLowerCase()}%`;
      donde.push(
        or(
          like(sql`lower(${t.productos.nombre})`, q),
          like(sql`lower(${t.productos.descripcion})`, q),
          like(sql`lower(${t.productos.sku})`, q),
        )!,
      );
    }

    const orden =
      filtro.orden === 'precio-asc' ? asc(t.productos.precio)
      : filtro.orden === 'precio-desc' ? desc(t.productos.precio)
      : desc(t.productos.creadoEn);

    let consulta = orm.select().from(t.productos).where(and(...donde)).orderBy(orden).$dynamic();
    if (filtro.limite) consulta = consulta.limit(filtro.limite);

    return (await consulta).map(aProducto);
  },

  async obtenerProducto(slug) {
    const [f] = await orm.select().from(t.productos).where(eq(t.productos.slug, slug)).limit(1);
    return f ? aProducto(f) : null;
  },

  async obtenerProductoPorId(pid) {
    const [f] = await orm.select().from(t.productos).where(eq(t.productos.id, pid)).limit(1);
    return f ? aProducto(f) : null;
  },

  async crearProducto(datos) {
    const nuevo: Producto = { ...datos, id: id(), creadoEn: ahora() };
    try {
      await orm.insert(t.productos).values(aFilaProducto(nuevo) as typeof t.productos.$inferInsert);
    } catch (e) {
      throw traducirConflicto(e, nuevo.slug, nuevo.sku);
    }
    return nuevo;
  },

  async actualizarProducto(pid, datos) {
    const cambios = aFilaProducto(datos);
    delete (cambios as Record<string, unknown>).id;
    delete (cambios as Record<string, unknown>).creadoEn;
    if (Object.keys(cambios).length === 0) return this.obtenerProductoPorId(pid);

    try {
      await orm.update(t.productos).set(cambios).where(eq(t.productos.id, pid));
    } catch (e) {
      throw traducirConflicto(e, datos.slug, datos.sku);
    }
    return this.obtenerProductoPorId(pid);
  },

  async eliminarProducto(pid) {
    /* Un producto que ya está en pedidos no se borra: se oculta. Borrarlo
       dejaría notas de clientes apuntando a la nada. */
    const [enUso] = await orm
      .select({ n: sql<number>`count(*)` })
      .from(t.pedidoItems)
      .where(eq(t.pedidoItems.productoId, pid));

    if (enUso && enUso.n > 0) {
      await orm.update(t.productos).set({ activo: false }).where(eq(t.productos.id, pid));
      throw new ErrorDeDatos(
        'Ese producto aparece en pedidos, así que no se puede borrar. Lo ocultamos de la tienda.',
        'conflicto',
      );
    }

    const r = await orm.delete(t.productos).where(eq(t.productos.id, pid));
    return r.rowsAffected > 0;
  },

  async listarCategorias() {
    return orm.select().from(t.categorias).orderBy(asc(t.categorias.orden)) as Promise<Categoria[]>;
  },

  async crearCategoria(datos) {
    const nueva: Categoria = { ...datos, id: id() };
    try {
      await orm.insert(t.categorias).values(nueva);
    } catch (e) {
      if (esUnico(e)) throw new ErrorDeDatos(`Ya existe una categoría en /tienda/${datos.slug}.`, 'conflicto');
      throw e;
    }
    return nueva;
  },

  async eliminarCategoria(cid) {
    const [conProductos] = await orm
      .select({ n: sql<number>`count(*)` })
      .from(t.productos)
      .where(eq(t.productos.categoriaId, cid));
    if (conProductos && conProductos.n > 0) {
      throw new ErrorDeDatos('La categoría tiene productos asignados. Muévelos antes de eliminarla.', 'conflicto');
    }

    const [conHijas] = await orm
      .select({ n: sql<number>`count(*)` })
      .from(t.categorias)
      .where(eq(t.categorias.padreId, cid));
    if (conHijas && conHijas.n > 0) {
      throw new ErrorDeDatos('La categoría tiene subcategorías. Elimínalas primero.', 'conflicto');
    }

    const r = await orm.delete(t.categorias).where(eq(t.categorias.id, cid));
    return r.rowsAffected > 0;
  },

  async listarSucursales() {
    return orm.select().from(t.sucursales) as Promise<Sucursal[]>;
  },

  async crearPedido(pedido) {
    await orm.transaction(async (tx) => {
      await tx.insert(t.pedidos).values({
        id: pedido.id,
        folio: pedido.folio,
        usuarioId: pedido.usuarioId,
        emailContacto: pedido.emailContacto,
        subtotal: pedido.subtotal,
        envio: pedido.envio,
        total: pedido.total,
        pagado: pedido.pagado,
        metodoEntrega: pedido.metodoEntrega,
        sucursalId: pedido.sucursalId,
        direccionId: null,
        estado: pedido.estado,
        stripeSessionId: pedido.stripeSessionId,
        stripePaymentIntentId: pedido.stripePaymentIntentId,
        pagadoEn: pedido.pagadoEn,
        creadoEn: pedido.creadoEn,
      });

      await tx.insert(t.pedidoItems).values(
        pedido.items.map((i) => ({
          id: id(),
          pedidoId: pedido.id,
          productoId: i.productoId,
          slug: i.slug,
          nombre: i.nombre,
          precio: i.precio,
          imagen: i.imagen,
          cantidad: i.cantidad,
        })),
      );
    });
    return pedido;
  },

  async obtenerPedidoPorSesion(sessionId) {
    const [f] = await orm.select().from(t.pedidos).where(eq(t.pedidos.stripeSessionId, sessionId)).limit(1);
    return f ? armarPedido(f) : null;
  },

  async listarPedidos(limite = 50) {
    const filas = await orm.select().from(t.pedidos).orderBy(desc(t.pedidos.creadoEn)).limit(limite);
    return Promise.all(filas.map((f) => armarPedido(f)));
  },

  async listarPedidosDeUsuario(usuarioId) {
    const filas = await orm
      .select()
      .from(t.pedidos)
      .where(eq(t.pedidos.usuarioId, usuarioId))
      .orderBy(desc(t.pedidos.creadoEn));
    return Promise.all(filas.map((f) => armarPedido(f)));
  },

  async asignarRol(email, rol) {
    const r = await orm.update(t.usuarios).set({ rol }).where(eq(t.usuarios.email, email));
    return r.rowsAffected > 0;
  },

  async marcarPagado({ sessionId, monto, paymentIntentId = null, direccion = null }) {
    return orm.transaction(async (tx) => {
      const [f] = await tx.select().from(t.pedidos).where(eq(t.pedidos.stripeSessionId, sessionId)).limit(1);
      if (!f) return null;

      const cambios = {
        pagado: monto,
        estado: 'pagado' as const,
        stripePaymentIntentId: paymentIntentId,
        pagadoEn: ahora(),
      };

      /* La condición `estado = 'pendiente_pago'` viaja DENTRO del UPDATE a
         propósito. Comprobarla antes con un SELECT deja una rendija entre leer y
         escribir, y por esa rendija pasan justo los dos caminos que confirman el
         mismo pedido casi a la vez: el webhook de Stripe y la página de retorno.
         Así solo uno de los dos ve rowsAffected > 0, y el otro sabe que llegó
         tarde sin haber tocado nada. */
      const r = await tx
        .update(t.pedidos)
        .set(cambios)
        .where(and(eq(t.pedidos.id, f.id), eq(t.pedidos.estado, 'pendiente_pago')));

      if (r.rowsAffected === 0) {
        // Ya estaba confirmado: evento repetido de Stripe, o el otro camino ganó.
        const [actual] = await tx.select().from(t.pedidos).where(eq(t.pedidos.id, f.id)).limit(1);
        return { pedido: await armarPedido(actual ?? f, tx), primeraVez: false };
      }

      /* De aquí abajo solo pasa quien ganó la carrera, así que nada se repite:
         ni el descuento de inventario ni la dirección. */
      let direccionId: string | null = f.direccionId;
      if (direccion) {
        direccionId = id();
        await tx.insert(t.direcciones).values({
          id: direccionId,
          /* Sin dueño a propósito: esto es la foto de a dónde se mandó ESTE
             pedido, no una entrada de la libreta del cliente. Colgarla del
             usuario haría que borrar la cuenta (cascada) se llevara por delante
             el destino de una entrega ya hecha. */
          usuarioId: null,
          nombre: direccion.nombre,
          calle: direccion.calle,
          numero: direccion.numero,
          colonia: direccion.colonia,
          ciudad: direccion.ciudad,
          estado: direccion.estado,
          cp: direccion.cp,
          telefono: direccion.telefono,
          referencias: direccion.referencias ?? null,
        });
        await tx.update(t.pedidos).set({ direccionId }).where(eq(t.pedidos.id, f.id));
      }

      // El inventario se descuenta al confirmar el cobro, nunca antes.
      const items = await tx.select().from(t.pedidoItems).where(eq(t.pedidoItems.pedidoId, f.id));
      for (const i of items) {
        await tx
          .update(t.productos)
          .set({ stock: sql`max(0, ${t.productos.stock} - ${i.cantidad})` })
          .where(eq(t.productos.id, i.productoId));
      }

      return { pedido: await armarPedido({ ...f, ...cambios, direccionId }, tx), primeraVez: true };
    });
  },

  async cancelarPedidoPorSesion(sessionId) {
    const [f] = await orm.select().from(t.pedidos).where(eq(t.pedidos.stripeSessionId, sessionId)).limit(1);
    if (!f) return null;

    /* Mismo candado que en marcarPagado, y por el mismo motivo: un pedido ya
       cobrado no se puede cancelar aunque llegue tarde el aviso de caducidad de
       la sesión. */
    const r = await orm
      .update(t.pedidos)
      .set({ estado: 'cancelado' })
      .where(and(eq(t.pedidos.id, f.id), eq(t.pedidos.estado, 'pendiente_pago')));
    if (r.rowsAffected === 0) return null;

    return armarPedido({ ...f, estado: 'cancelado' as const });
  },

  async registrarEvento(eventoId, tipo) {
    try {
      await orm.insert(t.eventosStripe).values({ id: eventoId, tipo, procesadoEn: ahora() });
      return true;
    } catch (e) {
      if (esUnico(e)) return false; // Stripe lo está reintentando
      throw e;
    }
  },

  async olvidarEvento(eventoId) {
    await orm.delete(t.eventosStripe).where(eq(t.eventosStripe.id, eventoId));
  },
};

/* --- Auxiliares -------------------------------------------------------- */

type FilaPedido = typeof t.pedidos.$inferSelect;
type Ejecutor = { select: typeof orm.select };

async function armarPedido(f: FilaPedido, ejecutor: Ejecutor = orm): Promise<Pedido> {
  const items = await ejecutor
    .select()
    .from(t.pedidoItems)
    .where(eq(t.pedidoItems.pedidoId, f.id));

  /* La dirección es la que capturó Stripe al pagar, no la que escribió nadie en
     el sitio: sin ella el pedido no se puede empacar. Solo la tienen los pedidos
     con envío ya confirmados. */
  const [dir] = f.direccionId
    ? await ejecutor.select().from(t.direcciones).where(eq(t.direcciones.id, f.direccionId)).limit(1)
    : [];

  return {
    id: f.id,
    folio: f.folio,
    usuarioId: f.usuarioId,
    emailContacto: f.emailContacto,
    items: items.map(
      (i): ItemCarrito => ({
        productoId: i.productoId,
        slug: i.slug,
        nombre: i.nombre,
        precio: i.precio,
        imagen: i.imagen,
        cantidad: i.cantidad,
      }),
    ),
    subtotal: f.subtotal,
    envio: f.envio,
    total: f.total,
    pagado: f.pagado,
    metodoEntrega: f.metodoEntrega,
    sucursalId: f.sucursalId,
    direccion: dir
      ? {
          id: dir.id,
          nombre: dir.nombre,
          calle: dir.calle,
          numero: dir.numero,
          colonia: dir.colonia,
          ciudad: dir.ciudad,
          estado: dir.estado,
          cp: dir.cp,
          telefono: dir.telefono,
          referencias: dir.referencias ?? undefined,
        }
      : null,
    estado: f.estado,
    stripeSessionId: f.stripeSessionId,
    stripePaymentIntentId: f.stripePaymentIntentId,
    pagadoEn: f.pagadoEn,
    creadoEn: f.creadoEn,
  };
}

/* libSQL envuelve el error de SQLite: el texto útil y los códigos viven en la
   cadena de `cause`, no en el mensaje de arriba. Hay que recorrerla entera o
   los conflictos de unicidad se escapan como error 500. */
function cadenaDeErrores(e: unknown): { code?: string; rawCode?: number; message?: string }[] {
  const cadena = [];
  let actual = e as { cause?: unknown; code?: string; rawCode?: number; message?: string } | undefined;
  while (actual && cadena.length < 8) {
    cadena.push(actual);
    actual = actual.cause as typeof actual;
  }
  return cadena;
}

function textoDeError(e: unknown): string {
  return cadenaDeErrores(e).map((x) => x.message ?? '').join(' | ');
}

function esUnico(e: unknown): boolean {
  return cadenaDeErrores(e).some(
    (x) =>
      x.rawCode === 1555 || // SQLITE_CONSTRAINT_PRIMARYKEY
      x.rawCode === 2067 || // SQLITE_CONSTRAINT_UNIQUE
      x.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      x.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ||
      /UNIQUE constraint failed/i.test(x.message ?? ''),
  );
}

function traducirConflicto(e: unknown, slug?: string, sku?: string): Error {
  if (!esUnico(e)) return e as Error;
  if (sku && /productos\.sku/.test(textoDeError(e))) {
    return new ErrorDeDatos(`Ya hay un producto con el SKU ${sku}.`, 'conflicto');
  }
  return new ErrorDeDatos(`Ya hay un producto en /producto/${slug}.`, 'conflicto');
}
