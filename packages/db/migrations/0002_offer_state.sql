ALTER TABLE `offers` ADD `overrides` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `offers` ADD `price_snapshot` text;--> statement-breakpoint
ALTER TABLE `offers` ADD `transcript` text;--> statement-breakpoint
ALTER TABLE `offers` ADD `recording_ms` integer;--> statement-breakpoint
ALTER TABLE `offers` ADD `processing_step` text;