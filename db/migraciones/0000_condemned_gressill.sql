CREATE TABLE `abonos` (
	`id` text PRIMARY KEY NOT NULL,
	`pedido_id` text NOT NULL,
	`monto` integer NOT NULL,
	`stripe_payment_intent_id` text,
	`fecha` text NOT NULL,
	FOREIGN KEY (`pedido_id`) REFERENCES `pedidos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `abonos_pedido_idx` ON `abonos` (`pedido_id`);--> statement-breakpoint
CREATE TABLE `categorias` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`nombre` text NOT NULL,
	`padre_id` text,
	`acento` text DEFAULT 'tinta' NOT NULL,
	`orden` integer DEFAULT 99 NOT NULL,
	`activa` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categorias_slug_idx` ON `categorias` (`slug`);--> statement-breakpoint
CREATE INDEX `categorias_padre_idx` ON `categorias` (`padre_id`);--> statement-breakpoint
CREATE TABLE `direcciones` (
	`id` text PRIMARY KEY NOT NULL,
	`usuario_id` text,
	`nombre` text NOT NULL,
	`calle` text NOT NULL,
	`numero` text NOT NULL,
	`colonia` text NOT NULL,
	`ciudad` text NOT NULL,
	`estado` text NOT NULL,
	`cp` text NOT NULL,
	`telefono` text NOT NULL,
	`referencias` text,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `eventos_stripe` (
	`id` text PRIMARY KEY NOT NULL,
	`tipo` text NOT NULL,
	`procesado_en` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lista_deseos` (
	`usuario_id` text NOT NULL,
	`producto_id` text NOT NULL,
	`agregado_en` text NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`producto_id`) REFERENCES `productos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lista_deseos_pk` ON `lista_deseos` (`usuario_id`,`producto_id`);--> statement-breakpoint
CREATE TABLE `pedido_items` (
	`id` text PRIMARY KEY NOT NULL,
	`pedido_id` text NOT NULL,
	`producto_id` text NOT NULL,
	`slug` text NOT NULL,
	`nombre` text NOT NULL,
	`precio` integer NOT NULL,
	`anticipo` integer DEFAULT 0 NOT NULL,
	`imagen` text DEFAULT '' NOT NULL,
	`cantidad` integer NOT NULL,
	`modo` text NOT NULL,
	FOREIGN KEY (`pedido_id`) REFERENCES `pedidos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`producto_id`) REFERENCES `productos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pedido_items_pedido_idx` ON `pedido_items` (`pedido_id`);--> statement-breakpoint
CREATE TABLE `pedidos` (
	`id` text PRIMARY KEY NOT NULL,
	`folio` text NOT NULL,
	`usuario_id` text,
	`email_contacto` text NOT NULL,
	`subtotal` integer NOT NULL,
	`envio` integer DEFAULT 0 NOT NULL,
	`total` integer NOT NULL,
	`pagado` integer DEFAULT 0 NOT NULL,
	`metodo_entrega` text NOT NULL,
	`sucursal_id` text,
	`direccion_id` text,
	`estado` text DEFAULT 'pendiente_pago' NOT NULL,
	`es_apartado` integer DEFAULT false NOT NULL,
	`vence_en` text,
	`stripe_session_id` text,
	`creado_en` text NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sucursal_id`) REFERENCES `sucursales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`direccion_id`) REFERENCES `direcciones`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pedidos_folio_idx` ON `pedidos` (`folio`);--> statement-breakpoint
CREATE UNIQUE INDEX `pedidos_sesion_idx` ON `pedidos` (`stripe_session_id`);--> statement-breakpoint
CREATE INDEX `pedidos_usuario_idx` ON `pedidos` (`usuario_id`,`creado_en`);--> statement-breakpoint
CREATE INDEX `pedidos_vencimiento_idx` ON `pedidos` (`vence_en`);--> statement-breakpoint
CREATE TABLE `productos` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`nombre` text NOT NULL,
	`descripcion` text DEFAULT '' NOT NULL,
	`sku` text NOT NULL,
	`precio` integer NOT NULL,
	`precio_anterior` integer,
	`stock` integer DEFAULT 0 NOT NULL,
	`categoria_id` text NOT NULL,
	`imagenes` text DEFAULT '[]' NOT NULL,
	`apartable` integer DEFAULT false NOT NULL,
	`anticipo_minimo` integer DEFAULT 0 NOT NULL,
	`plazo_semanas` integer DEFAULT 0 NOT NULL,
	`temporada` integer DEFAULT false NOT NULL,
	`destacado` integer DEFAULT false NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`creado_en` text NOT NULL,
	FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `productos_slug_idx` ON `productos` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `productos_sku_idx` ON `productos` (`sku`);--> statement-breakpoint
CREATE INDEX `productos_categoria_idx` ON `productos` (`categoria_id`);--> statement-breakpoint
CREATE INDEX `productos_temporada_idx` ON `productos` (`temporada`);--> statement-breakpoint
CREATE INDEX `productos_apartable_idx` ON `productos` (`apartable`);--> statement-breakpoint
CREATE TABLE `sucursales` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`direccion` text NOT NULL,
	`horario` text NOT NULL,
	`cp` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`email` text NOT NULL,
	`rol` text DEFAULT 'cliente' NOT NULL,
	`creado_en` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usuarios_email_idx` ON `usuarios` (`email`);