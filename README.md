# Orta Novedades

Tienda en línea con Astro, Tailwind, islas de Preact + Nanostores y pagos con Stripe.

```bash
npm install
cp .env.example .env   # pega tus claves de Stripe
npm run db:migrate     # crea orta.db
npm run db:seed        # catálogo inicial
npm run dev            # http://localhost:4321
```

Crea tu cuenta en `/entrar` y asciéndela a administrador:

```bash
npx tsx scripts/hacer-admin.ts tu@correo.mx
```

---

## Sistema de diseño: "El Mostrador"

| Rol | Token | Hex | Dónde se usa |
|---|---|---|---|
| Acción | `cielo` | `#00A3E0` | Botones primarios, enlaces, foco, barra de progreso |
| Temporada | `oro` | `#EAB308` | Badges de rebaja, franja de temporada |
| Acento | `mistico` | `#A855F7` | Acento de categorías especiales |
| Texto | `tinta` | `#18181B` | Encabezados, cuerpo, footer, panel |
| Superficie | `papel` | `#FFFFFF` | Tarjetas y contenedores |

Cada color tiene un trabajo y no se intercambian.

**Tipografía.** *Archivo Variable* en eje ancho expandido (`.rotulo`) para títulos,
lógica de rótulo pintado; *Karla* para cuerpo; *Space Mono* para folios, precios,
SKU y contadores — el monoespaciado aquí es funcional, son cifras de nota.

**Elemento firma: la nota del mostrador** (`.nota` y `.nota-corte` en
`src/styles/global.css`). Recibo con muesca troquelada, guías punteadas y folio.
Aparece en la confirmación de pago. Es la única pieza maximalista del sitio; el
resto se mantiene callado a propósito.

---

## Estructura de carpetas

```
orta/
├── astro.config.mjs          # SSR + adaptador Node, integraciones Preact y Tailwind
├── tailwind.config.cjs       # Paleta, escala de rótulo, animaciones de marca
├── drizzle.config.ts         # Generación de migraciones
├── db/migraciones/           # SQL generado desde src/lib/schema.ts — no se edita a mano
├── scripts/seed.ts           # Siembra idempotente del catálogo inicial
└── src/
    ├── middleware.ts         # Guardia de rutas por rol (/admin, /cuenta, /api/admin)
    ├── env.d.ts              # Tipos de Astro.locals y variables de entorno
    │
    ├── layouts/
    │   ├── BaseLayout.astro  # Tienda: head, SEO, Header, Footer, cajón del carrito
    │   └── AdminLayout.astro # Panel: noindex, navegación de secciones
    │
    ├── components/
    │   ├── layout/           # AnnouncementBar · Header · Navbar · Footer
    │   ├── commerce/         # ProductCard · Catalogo · ProductoImagen
    │   ├── islands/          # Preact hidratado: CartButton, CartDrawer, AddToCart,
    │   │                     #   Checkout, FormularioEntrar, FormularioRestablecer
    │   └── admin/            # ProductForm · CategoryForm
    │
    ├── stores/
    │   └── cart.ts           # Nanostores: carrito persistente y estado del cajón
    │
    ├── lib/
    │   ├── types.ts          # Modelo de dominio (importes en centavos MXN)
    │   ├── schema.ts         # Esquema Drizzle: única fuente de verdad de la base
    │   ├── repositorio.ts    # Interfaz Repositorio + ErrorDeDatos
    │   ├── sqlite.ts         # Implementación sobre libSQL
    │   ├── db.ts             # Punto de entrada: elige la implementación
    │   ├── auth.ts           # Better Auth: adaptador, rol, sesiones y correos
    │   ├── auth-cliente.ts   # Cliente de auth + validaciones compartidas
    │   ├── correo.ts         # Envío con Resend y plantillas de correo
    │   ├── entorno.ts        # Variables, URL canónica y orígenes confiables
    │   ├── stripe.ts         # SDK, line_items y creación de sesión de Checkout
    │   ├── shipping.ts       # Cotización nacional por código postal
    │   ├── session.ts        # Lectura de sesión y rutas protegidas
    │   └── money.ts          # Formato MXN y folios
    │
    ├── data/seed.ts          # Catálogo inicial de demostración
    ├── styles/global.css     # Capa base, componentes de marca (.nota, .guia)
    │
    └── pages/
        ├── index.astro
        ├── tienda/index.astro · tienda/[categoria].astro
        ├── producto/[slug].astro
        ├── temporada.astro
        ├── checkout/index.astro · checkout/exito.astro
        ├── entrar.astro · verificar.astro · restablecer.astro · 404.astro
        ├── admin/index.astro · admin/categorias.astro
        │   └── admin/productos/index.astro · nuevo.astro · [id].astro
        └── api/
            ├── checkout.ts               # Crea el pedido y la sesión de Stripe
            ├── webhooks/stripe.ts        # Confirma el cobro (fuente de verdad)
            ├── shipping/quote.ts         # Cotiza envío por CP
            └── admin/products/ · admin/categories/
```

### Qué se hidrata y qué no

El catálogo entero se renderiza en el servidor: cero JavaScript en la mayoría de la
página. Solo cuatro islas cargan Preact.

| Isla | Directiva | Por qué |
|---|---|---|
| `CartButton` | `client:load` | El contador debe ser correcto desde el primer pintado |
| `CartDrawer` | `client:load` | "Agregar" lo abre al instante; con `idle` habría una ventana muerta |
| `AddToCart` | `client:visible` en rejilla, `client:load` en ficha | Solo hidrata las tarjetas que se ven |
| `ProductForm` / `CategoryForm` / `Checkout` | `client:load` | Formularios interactivos, fuera de la ruta crítica pública |

El estado se comparte entre islas con Nanostores (`src/stores/cart.ts`), persistido en
`localStorage` para sobrevivir la navegación entre documentos.

---

## Datos

Drizzle sobre libSQL: un archivo SQLite en desarrollo y Turso en producción con
el mismo código — solo cambian `DATABASE_URL` y `DATABASE_AUTH_TOKEN`.

[src/lib/schema.ts](src/lib/schema.ts) es la única definición del esquema; el SQL
de `db/migraciones/` se genera desde ahí y no se edita a mano.

| Comando | Qué hace |
|---|---|
| `npm run db:generate` | Genera la migración tras cambiar el esquema |
| `npm run db:migrate` | Aplica migraciones pendientes |
| `npm run db:seed` | Siembra el catálogo si la base está vacía |
| `npm run db:reset` | Vacía y vuelve a sembrar |
| `npm run db:studio` | Explorador visual de la base |
| `npm run db:probar` | Diagnóstico: a dónde apunta, si responde y si le faltan tablas |
| `npm run admin -- correo` | Asciende una cuenta a administrador |

`db:reset` vacía el catálogo pero **no** las cuentas: rehacer los productos de
prueba no es motivo para echar a todos de su sesión.

Tres invariantes que la capa sostiene:

- **El cobro y el descuento de inventario ocurren en una sola transacción**, y solo
  la primera vez que se confirma el pedido: un evento repetido de Stripe no vuelve a
  descontar ni a mandar otro correo de confirmación.
- **Los webhooks son idempotentes.** `eventos_stripe` guarda cada id de evento; un
  reintento de Stripe se reconoce y no repite el efecto.
- **Un producto que ya aparece en pedidos no se borra**, se oculta. Borrarlo dejaría
  notas de clientes apuntando a la nada.

Límite conocido: la validación de stock en el checkout y el descuento en el webhook
no son atómicos entre sí. Dos clientes pueden pasar la validación con una sola pieza
en existencia; el segundo cobro se acepta y el stock queda en cero en vez de negativo.
Para el volumen de una tienda de mostrador es tolerable, pero si se vuelve un problema
la solución es reservar la pieza al crear la sesión de Stripe y liberarla al expirar.

## Roles y permisos

| | Invitado | Cliente | Administrador |
|---|---|---|---|
| Catálogo, búsqueda, filtros | ✓ | ✓ | ✓ |
| Carrito y checkout | ✓ | ✓ | ✓ |
| Historial y rastreo de pedidos | — | ✓ | ✓ |
| Panel, productos, categorías, métricas | — | — | ✓ |

`src/middleware.ts` aplica las reglas antes de renderizar. Las páginas devuelven un
redirect a `/entrar?destino=…`; las rutas `/api/*` devuelven 401 o 403 en JSON. El
checkout es público a propósito: el guest checkout es un requisito, no una excepción.

### Autenticación

Better Auth con correo y contraseña, configurado en [src/lib/auth.ts](src/lib/auth.ts).
Los usuarios viven en la misma base que el catálogo, así que `pedidos.usuario_id`
apunta directo a la tabla `usuarios` y no hay dos almacenes que sincronizar.

- La sesión es una cookie httpOnly con prefijo `orta.`, validada contra la tabla
  `sesiones`. Con `cookieCache` la mayoría de las navegaciones no tocan la base.
- **El rol no se acepta desde el registro** (`input: false`). Mandar `rol: "admin"`
  en el alta crea una cuenta de cliente normal. Ascender es solo por script.
- Cambiar `BETTER_AUTH_SECRET` invalida todas las sesiones abiertas.
- `/api/auth/*` queda fuera del guardia del middleware: es la puerta, no puede
  estar detrás de la cerradura.

Better Auth exige cabecera `Origin` del mismo origen en las operaciones que
escriben. Un navegador siempre la manda; si pruebas con `curl` o PowerShell y
recibes 403, es eso.

---

## Flujo de pago con Stripe

Stripe es el único método de pago. Se usa **Checkout alojado**, así que ningún dato
de tarjeta toca el servidor de Orta y el alcance de PCI queda en SAQ A. Apple Pay y
Google Pay aparecen solos en Checkout cuando el dominio está verificado en el panel
de Stripe.

```
Cliente                    Orta (Astro SSR)              Stripe
   │                            │                           │
   │ 1. "Pagar" ───────────────►│                           │
   │    (ids + cantidades)      │                           │
   │                            │ 2. relee precios de la BD │
   │                            │    valida stock y CP      │
   │                            │ 3. crea pedido            │
   │                            │    estado: pendiente_pago │
   │                            │                           │
   │                            │ 4. checkout.sessions ────►│
   │                            │◄──── session.url ─────────│
   │ 5. redirect ──────────────────────────────────────────►│
   │                                                        │
   │ 6. captura tarjeta / Apple Pay / Google Pay ───────────►│
   │                                                        │
   │                            │◄── 7. webhook ────────────│
   │                            │  checkout.session.completed
   │                            │  · marca pagado           │
   │                            │  · descuenta inventario   │
   │                            │  · envía confirmación     │
   │◄─── 8. /checkout/exito ────│                           │
```

Tres reglas que sostienen el flujo:

1. **Los precios nunca vienen del navegador.** `POST /api/checkout` solo acepta ids y
   cantidades; el importe se recalcula leyendo la base ([src/pages/api/checkout.ts](src/pages/api/checkout.ts)).
2. **El pedido se crea antes de redirigir.** Si Stripe cobra, siempre hay un pedido al
   cual atribuir el cobro.
3. **La página de éxito no confirma nada.** El único punto que cambia el estado y el
   inventario es el webhook ([src/pages/api/webhooks/stripe.ts](src/pages/api/webhooks/stripe.ts)),
   con la firma verificada.

### Probar en local

```bash
stripe listen --forward-to localhost:4321/api/webhooks/stripe
```

Copia el `whsec_…` que imprime a `STRIPE_WEBHOOK_SECRET`. Tarjeta de prueba:
`4242 4242 4242 4242`, cualquier fecha futura y CVC.

---

## Publicar: Turso y Resend

El código ya habla con los dos; lo que falta al desplegar son las credenciales.
Mientras no estén, el sitio **no revienta**: arranca en modo demo con el catálogo
de muestra en memoria y sin verificación de correo. Eso sirve para enseñarlo, no
para vender — nada de lo que se escriba se conserva.

> Los scripts de mantenimiento (`db:*`, `correo:probar`) leen `.env` por su cuenta
> vía [scripts/entorno-local.ts](scripts/entorno-local.ts). El dev server lo hace
> Vite, pero `drizzle-kit` y `tsx` arrancan con el entorno pelado del sistema: sin
> ese cargador, `db:migrate` diría que migró y lo habría hecho sobre `orta.db`
> mientras la base remota se queda vacía.

### 1. Base de datos en Turso

1. Crea la base en [turso.tech/app](https://turso.tech/app). Con la CLI sería
   `turso db create orta`, pero en Windows la CLI pide WSL y el panel hace lo mismo.
2. Copia la URL de conexión (`libsql://orta-tuorg.turso.io`) y genera un token.
3. Ponlas en tu `.env` local:

```bash
DATABASE_URL=libsql://orta-tuorg.turso.io
DATABASE_AUTH_TOKEN=eyJhbGci...
```

4. Crea el esquema y siembra el catálogo **en la base remota**:

```bash
npm run db:migrate && npm run db:seed && npm run db:probar
```

`db:probar` es el que confirma que quedó bien: dice a dónde apunta, si responde,
qué tablas faltan y con qué comando arreglarlo. Es el paso que separa un
despliegue que funciona de uno que responde 500 en la primera consulta.

5. Las mismas dos variables en **Vercel > Settings > Environment Variables**. El
   token va solo en el servidor: nunca en una variable `PUBLIC_`.

En cuanto `DATABASE_URL` deja de empezar por `file:`, el modo demo se apaga solo y
[src/lib/sqlite.ts](src/lib/sqlite.ts) carga el driver `libsql/web`, que habla con
Turso por HTTP y no arrastra el binario nativo que el empaquetador de Vercel no
sabe copiar dentro de la función.

### 2. Correo con Resend

1. Crea la cuenta en [resend.com](https://resend.com).
2. **Domains > Add Domain** y pon los registros DNS donde tengas el dominio. Este
   paso no se salta: sin dominio verificado solo puedes usar `onboarding@resend.dev`,
   que entrega **únicamente** a la dirección con la que abriste la cuenta. Sirve
   para probar, no para clientes.
3. **API Keys > Create API Key**.
4. En `.env` y en Vercel:

```bash
RESEND_API_KEY=re_...
CORREO_REMITENTE=Orta Novedades <hola@tudominio.mx>
```

5. Compruébalo sin registrar a nadie:

```bash
npm run correo:probar -- tu@correo.mx
```

Manda la plantilla real de verificación por el mismo camino que el sitio, y si
Resend la rechaza traduce el error: clave inválida (401), dominio sin verificar
(403) o remitente mal formado (422). Desde dentro del sitio esos tres se ven
igual — "no llegó el correo" — porque Better Auth los convierte en un 500 genérico
y el motivo real se queda en los logs de la función.

Con las dos variables puestas, la verificación de correo al registrarse se activa
sola ([src/lib/auth.ts](src/lib/auth.ts)). Los valores de ejemplo de `.env.example`
no cuentan: copiar el archivo y no rellenarlo deja el sitio como si no hubiera
proveedor, en vez de exigir un correo que nunca saldría.

### 3. Lo demás del entorno

`PUBLIC_SITE_URL` con el dominio real (si no, los enlaces de los correos salen con
la URL del despliegue, que caduca al publicar el siguiente), un
`BETTER_AUTH_SECRET` nuevo y las claves de Stripe de producción.

---

## Antes de publicar

- [ ] Base en Turso y correo en Resend — pasos en [Publicar](#publicar-turso-y-resend).
      Sin ellos el sitio se publica en modo demo: catálogo en memoria, sin correos
      y sin verificación de cuenta. Confírmalo con `npm run db:probar` y
      `npm run correo:probar`.
- [ ] Registrar el webhook de producción y verificar el dominio para Apple Pay.
- [ ] Cambiar la cotización de `src/lib/shipping.ts` por la API de la paquetería.
- [ ] Crear las rutas que aún enlazan a 404: `/nosotros`, `/envios`,
      `/devoluciones`, `/privacidad`, `/terminos`, `/tienda/novedades`,
      `/admin/pedidos` y el endpoint `/api/boletin` del footer.
- [ ] Subida real de imágenes en el panel (hoy el formulario acepta URLs).
