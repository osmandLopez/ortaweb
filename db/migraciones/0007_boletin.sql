CREATE TABLE `suscriptores` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`token` text NOT NULL,
	`creado_en` text NOT NULL,
	`baja_en` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suscriptores_email_idx` ON `suscriptores` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `suscriptores_token_idx` ON `suscriptores` (`token`);