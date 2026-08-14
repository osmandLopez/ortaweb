CREATE TABLE `cuentas` (
	`id` text PRIMARY KEY NOT NULL,
	`cuenta_externa_id` text NOT NULL,
	`proveedor` text NOT NULL,
	`usuario_id` text NOT NULL,
	`token_acceso` text,
	`token_refresco` text,
	`token_id` text,
	`token_acceso_expira_en` integer,
	`token_refresco_expira_en` integer,
	`alcance` text,
	`password` text,
	`creado_en` integer NOT NULL,
	`actualizado_en` integer NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cuentas_usuario_idx` ON `cuentas` (`usuario_id`);--> statement-breakpoint
CREATE TABLE `sesiones` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`usuario_id` text NOT NULL,
	`expira_en` integer NOT NULL,
	`ip` text,
	`agente` text,
	`creado_en` integer NOT NULL,
	`actualizado_en` integer NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sesiones_token_idx` ON `sesiones` (`token`);--> statement-breakpoint
CREATE INDEX `sesiones_usuario_idx` ON `sesiones` (`usuario_id`);--> statement-breakpoint
CREATE TABLE `verificaciones` (
	`id` text PRIMARY KEY NOT NULL,
	`identificador` text NOT NULL,
	`valor` text NOT NULL,
	`expira_en` integer NOT NULL,
	`creado_en` integer,
	`actualizado_en` integer
);
--> statement-breakpoint
CREATE INDEX `verificaciones_identificador_idx` ON `verificaciones` (`identificador`);--> statement-breakpoint
DROP INDEX "abonos_pedido_idx";--> statement-breakpoint
DROP INDEX "categorias_slug_idx";--> statement-breakpoint
DROP INDEX "categorias_padre_idx";--> statement-breakpoint
DROP INDEX "cuentas_usuario_idx";--> statement-breakpoint
DROP INDEX "lista_deseos_pk";--> statement-breakpoint
DROP INDEX "pedido_items_pedido_idx";--> statement-breakpoint
DROP INDEX "pedidos_folio_idx";--> statement-breakpoint
DROP INDEX "pedidos_sesion_idx";--> statement-breakpoint
DROP INDEX "pedidos_usuario_idx";--> statement-breakpoint
DROP INDEX "pedidos_vencimiento_idx";--> statement-breakpoint
DROP INDEX "productos_slug_idx";--> statement-breakpoint
DROP INDEX "productos_sku_idx";--> statement-breakpoint
DROP INDEX "productos_categoria_idx";--> statement-breakpoint
DROP INDEX "productos_temporada_idx";--> statement-breakpoint
DROP INDEX "productos_apartable_idx";--> statement-breakpoint
DROP INDEX "sesiones_token_idx";--> statement-breakpoint
DROP INDEX "sesiones_usuario_idx";--> statement-breakpoint
DROP INDEX "usuarios_email_idx";--> statement-breakpoint
DROP INDEX "verificaciones_identificador_idx";--> statement-breakpoint
ALTER TABLE `usuarios` ALTER COLUMN "creado_en" TO "creado_en" integer NOT NULL;--> statement-breakpoint
CREATE INDEX `abonos_pedido_idx` ON `abonos` (`pedido_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `categorias_slug_idx` ON `categorias` (`slug`);--> statement-breakpoint
CREATE INDEX `categorias_padre_idx` ON `categorias` (`padre_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `lista_deseos_pk` ON `lista_deseos` (`usuario_id`,`producto_id`);--> statement-breakpoint
CREATE INDEX `pedido_items_pedido_idx` ON `pedido_items` (`pedido_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `pedidos_folio_idx` ON `pedidos` (`folio`);--> statement-breakpoint
CREATE UNIQUE INDEX `pedidos_sesion_idx` ON `pedidos` (`stripe_session_id`);--> statement-breakpoint
CREATE INDEX `pedidos_usuario_idx` ON `pedidos` (`usuario_id`,`creado_en`);--> statement-breakpoint
CREATE INDEX `pedidos_vencimiento_idx` ON `pedidos` (`vence_en`);--> statement-breakpoint
CREATE UNIQUE INDEX `productos_slug_idx` ON `productos` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `productos_sku_idx` ON `productos` (`sku`);--> statement-breakpoint
CREATE INDEX `productos_categoria_idx` ON `productos` (`categoria_id`);--> statement-breakpoint
CREATE INDEX `productos_temporada_idx` ON `productos` (`temporada`);--> statement-breakpoint
CREATE INDEX `productos_apartable_idx` ON `productos` (`apartable`);--> statement-breakpoint
CREATE UNIQUE INDEX `usuarios_email_idx` ON `usuarios` (`email`);--> statement-breakpoint
ALTER TABLE `usuarios` ADD `email_verificado` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `usuarios` ADD `imagen` text;--> statement-breakpoint
ALTER TABLE `usuarios` ADD `actualizado_en` integer NOT NULL;