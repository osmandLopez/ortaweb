DROP TABLE `abonos`;--> statement-breakpoint
DROP INDEX `pedidos_vencimiento_idx`;--> statement-breakpoint
ALTER TABLE `pedidos` DROP COLUMN `es_apartado`;--> statement-breakpoint
ALTER TABLE `pedidos` DROP COLUMN `vence_en`;--> statement-breakpoint
DROP INDEX `productos_apartable_idx`;--> statement-breakpoint
ALTER TABLE `productos` DROP COLUMN `apartable`;--> statement-breakpoint
ALTER TABLE `productos` DROP COLUMN `anticipo_minimo`;--> statement-breakpoint
ALTER TABLE `productos` DROP COLUMN `plazo_semanas`;--> statement-breakpoint
ALTER TABLE `pedido_items` DROP COLUMN `anticipo`;--> statement-breakpoint
ALTER TABLE `pedido_items` DROP COLUMN `modo`;