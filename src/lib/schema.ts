import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/*
 * Esquema de la base — única fuente de verdad.
 *
 * Las migraciones de db/ se generan desde aquí con `npm run db:generate`; no se
 * escriben a mano, para que no haya dos definiciones que se separen con el tiempo.
 *
 * Convenciones:
 *   · Dinero  -> integer, centavos MXN. Nunca coma flotante.
 *   · Fechas  -> text ISO 8601, igual que el modelo de src/lib/types.ts.
 *   · Listas  -> text con JSON, leídas y escritas por la capa de repositorio.
 */

/* --- Autenticación ------------------------------------------------------
 *
 * Estas cuatro tablas las llena Better Auth. Las columnas SQL van en español
 * como el resto de la base, pero las propiedades de Drizzle conservan los
 * nombres que Better Auth espera: así el adaptador funciona sin mapeos y no
 * hay una capa de traducción donde se cuelen errores.
 *
 * `rol` es campo del usuario, no tabla aparte: solo hay dos roles y el
 * middleware necesita leerlo en cada petición.
 */

export const usuarios = sqliteTable(
  'usuarios',
  {
    id: text('id').primaryKey(),
    name: text('nombre').notNull(),
    email: text('email').notNull(),
    emailVerified: integer('email_verificado', { mode: 'boolean' }).notNull().default(false),
    image: text('imagen'),
    rol: text('rol', { enum: ['admin', 'cliente'] }).notNull().default('cliente'),
    createdAt: integer('creado_en', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('actualizado_en', { mode: 'timestamp' }).notNull(),
  },
  (t) => [uniqueIndex('usuarios_email_idx').on(t.email)],
);

export const sesiones = sqliteTable(
  'sesiones',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull(),
    userId: text('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    expiresAt: integer('expira_en', { mode: 'timestamp' }).notNull(),
    ipAddress: text('ip'),
    userAgent: text('agente'),
    createdAt: integer('creado_en', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('actualizado_en', { mode: 'timestamp' }).notNull(),
  },
  (t) => [uniqueIndex('sesiones_token_idx').on(t.token), index('sesiones_usuario_idx').on(t.userId)],
);

/** Credenciales por proveedor. Con correo y contraseña guarda el hash en `password`. */
export const cuentas = sqliteTable(
  'cuentas',
  {
    id: text('id').primaryKey(),
    accountId: text('cuenta_externa_id').notNull(),
    providerId: text('proveedor').notNull(),
    userId: text('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    accessToken: text('token_acceso'),
    refreshToken: text('token_refresco'),
    idToken: text('token_id'),
    accessTokenExpiresAt: integer('token_acceso_expira_en', { mode: 'timestamp' }),
    refreshTokenExpiresAt: integer('token_refresco_expira_en', { mode: 'timestamp' }),
    scope: text('alcance'),
    password: text('password'),
    createdAt: integer('creado_en', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('actualizado_en', { mode: 'timestamp' }).notNull(),
  },
  (t) => [index('cuentas_usuario_idx').on(t.userId)],
);

/** Tokens de un solo uso: verificación de correo y restablecer contraseña. */
export const verificaciones = sqliteTable(
  'verificaciones',
  {
    id: text('id').primaryKey(),
    identifier: text('identificador').notNull(),
    value: text('valor').notNull(),
    expiresAt: integer('expira_en', { mode: 'timestamp' }).notNull(),
    createdAt: integer('creado_en', { mode: 'timestamp' }),
    updatedAt: integer('actualizado_en', { mode: 'timestamp' }),
  },
  (t) => [index('verificaciones_identificador_idx').on(t.identifier)],
);

export const categorias = sqliteTable(
  'categorias',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    nombre: text('nombre').notNull(),
    // Sin cascada a propósito: borrar una categoría madre con hijas debe fallar,
    // no llevarse el árbol por delante.
    padreId: text('padre_id'),
    acento: text('acento', { enum: ['cielo', 'oro', 'mistico', 'tinta'] }).notNull().default('tinta'),
    orden: integer('orden').notNull().default(99),
    activa: integer('activa', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [uniqueIndex('categorias_slug_idx').on(t.slug), index('categorias_padre_idx').on(t.padreId)],
);

export const productos = sqliteTable(
  'productos',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    nombre: text('nombre').notNull(),
    descripcion: text('descripcion').notNull().default(''),
    sku: text('sku').notNull(),
    precio: integer('precio').notNull(),
    precioAnterior: integer('precio_anterior'),
    stock: integer('stock').notNull().default(0),
    categoriaId: text('categoria_id')
      .notNull()
      .references(() => categorias.id),
    imagenes: text('imagenes').notNull().default('[]'), // JSON: string[]
    apartable: integer('apartable', { mode: 'boolean' }).notNull().default(false),
    anticipoMinimo: integer('anticipo_minimo').notNull().default(0),
    plazoSemanas: integer('plazo_semanas').notNull().default(0),
    temporada: integer('temporada', { mode: 'boolean' }).notNull().default(false),
    destacado: integer('destacado', { mode: 'boolean' }).notNull().default(false),
    activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
    creadoEn: text('creado_en').notNull(),
  },
  (t) => [
    uniqueIndex('productos_slug_idx').on(t.slug),
    uniqueIndex('productos_sku_idx').on(t.sku),
    index('productos_categoria_idx').on(t.categoriaId),
    index('productos_temporada_idx').on(t.temporada),
    index('productos_apartable_idx').on(t.apartable),
  ],
);

export const sucursales = sqliteTable('sucursales', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  direccion: text('direccion').notNull(),
  horario: text('horario').notNull(),
  cp: text('cp').notNull(),
});

export const direcciones = sqliteTable('direcciones', {
  id: text('id').primaryKey(),
  usuarioId: text('usuario_id').references(() => usuarios.id, { onDelete: 'cascade' }),
  nombre: text('nombre').notNull(),
  calle: text('calle').notNull(),
  numero: text('numero').notNull(),
  colonia: text('colonia').notNull(),
  ciudad: text('ciudad').notNull(),
  estado: text('estado').notNull(),
  cp: text('cp').notNull(),
  telefono: text('telefono').notNull(),
  referencias: text('referencias'),
});

export const pedidos = sqliteTable(
  'pedidos',
  {
    id: text('id').primaryKey(),
    folio: text('folio').notNull(),
    // Null en compra de invitado, y también si el cliente borra su cuenta:
    // el pedido es un registro contable, no puede desaparecer con el usuario.
    usuarioId: text('usuario_id').references(() => usuarios.id, { onDelete: 'set null' }),
    emailContacto: text('email_contacto').notNull(),
    subtotal: integer('subtotal').notNull(),
    envio: integer('envio').notNull().default(0),
    total: integer('total').notNull(),
    pagado: integer('pagado').notNull().default(0),
    metodoEntrega: text('metodo_entrega', { enum: ['envio', 'pickup'] }).notNull(),
    sucursalId: text('sucursal_id').references(() => sucursales.id),
    direccionId: text('direccion_id').references(() => direcciones.id),
    estado: text('estado', {
      enum: [
        'pendiente_pago', 'pagado', 'apartado_activo', 'apartado_liquidado',
        'en_preparacion', 'enviado', 'listo_para_recoger', 'entregado', 'cancelado',
      ],
    }).notNull().default('pendiente_pago'),
    esApartado: integer('es_apartado', { mode: 'boolean' }).notNull().default(false),
    venceEn: text('vence_en'),
    stripeSessionId: text('stripe_session_id'),
    creadoEn: text('creado_en').notNull(),
  },
  (t) => [
    uniqueIndex('pedidos_folio_idx').on(t.folio),
    uniqueIndex('pedidos_sesion_idx').on(t.stripeSessionId),
    index('pedidos_usuario_idx').on(t.usuarioId, t.creadoEn),
    index('pedidos_vencimiento_idx').on(t.venceEn),
  ],
);

export const pedidoItems = sqliteTable(
  'pedido_items',
  {
    id: text('id').primaryKey(),
    pedidoId: text('pedido_id')
      .notNull()
      .references(() => pedidos.id, { onDelete: 'cascade' }),
    productoId: text('producto_id')
      .notNull()
      .references(() => productos.id),
    slug: text('slug').notNull(),
    // nombre y precio se congelan: el catálogo cambia, la nota del cliente no.
    nombre: text('nombre').notNull(),
    precio: integer('precio').notNull(),
    anticipo: integer('anticipo').notNull().default(0),
    imagen: text('imagen').notNull().default(''),
    cantidad: integer('cantidad').notNull(),
    modo: text('modo', { enum: ['compra', 'apartado'] }).notNull(),
  },
  (t) => [index('pedido_items_pedido_idx').on(t.pedidoId)],
);

export const abonos = sqliteTable(
  'abonos',
  {
    id: text('id').primaryKey(),
    pedidoId: text('pedido_id')
      .notNull()
      .references(() => pedidos.id, { onDelete: 'cascade' }),
    monto: integer('monto').notNull(),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    fecha: text('fecha').notNull(),
  },
  (t) => [index('abonos_pedido_idx').on(t.pedidoId)],
);

export const listaDeseos = sqliteTable(
  'lista_deseos',
  {
    usuarioId: text('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    productoId: text('producto_id')
      .notNull()
      .references(() => productos.id, { onDelete: 'cascade' }),
    agregadoEn: text('agregado_en').notNull(),
  },
  (t) => [uniqueIndex('lista_deseos_pk').on(t.usuarioId, t.productoId)],
);

/** Stripe reintenta los webhooks. Esta tabla es lo que evita cobrar dos veces. */
export const eventosStripe = sqliteTable('eventos_stripe', {
  id: text('id').primaryKey(),
  tipo: text('tipo').notNull(),
  procesadoEn: text('procesado_en').notNull(),
});
