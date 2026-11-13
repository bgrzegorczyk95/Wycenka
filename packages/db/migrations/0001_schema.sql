CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`offer_id` text NOT NULL,
	`company_id` text NOT NULL,
	`kind` text NOT NULL,
	`r2_key` text NOT NULL,
	`mime` text NOT NULL,
	`duration_ms` integer,
	`caption` text,
	`visible_to_client` integer DEFAULT false NOT NULL,
	`transcript` text,
	`uploaded_at` integer,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `at_offer` ON `attachments` (`offer_id`);--> statement-breakpoint
CREATE INDEX `at_company` ON `attachments` (`company_id`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`address` text,
	`district` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cl_company` ON `clients` (`company_id`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`nip` text,
	`phone` text,
	`email` text,
	`service_area` text,
	`logo_key` text,
	`trades` text NOT NULL,
	`custom_trade` text,
	`default_validity_days` integer DEFAULT 14 NOT NULL,
	`default_deposit_bps` integer DEFAULT 3000 NOT NULL,
	`default_vat_bps` integer DEFAULT 800,
	`plan` text DEFAULT 'free' NOT NULL,
	`plan_renews_at` integer,
	`offer_counter_month` text,
	`offer_counter` integer DEFAULT 0 NOT NULL,
	`onboarding_step` text DEFAULT 'profesja',
	`onboarded_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `offer_events` (
	`id` text PRIMARY KEY NOT NULL,
	`offer_id` text NOT NULL,
	`company_id` text NOT NULL,
	`type` text NOT NULL,
	`channel` text,
	`payload` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `oe_offer` ON `offer_events` (`offer_id`);--> statement-breakpoint
CREATE INDEX `oe_company` ON `offer_events` (`company_id`);--> statement-breakpoint
CREATE TABLE `offer_items` (
	`id` text PRIMARY KEY NOT NULL,
	`offer_id` text NOT NULL,
	`company_id` text NOT NULL,
	`item_key` text NOT NULL,
	`price_list_item_id` text,
	`name` text NOT NULL,
	`unit` text NOT NULL,
	`qty_milli` integer NOT NULL,
	`unit_price_gr` integer,
	`surcharge_bps` integer DEFAULT 0 NOT NULL,
	`value_gr` integer,
	`scope` text,
	`source_kind` text NOT NULL,
	`source_quote` text,
	`source_question_id` text,
	`locked` integer DEFAULT false NOT NULL,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `oi_offer` ON `offer_items` (`offer_id`);--> statement-breakpoint
CREATE INDEX `oi_company` ON `offer_items` (`company_id`);--> statement-breakpoint
CREATE TABLE `offers` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`client_id` text,
	`created_by_user_id` text NOT NULL,
	`client_uuid` text NOT NULL,
	`number` text,
	`title` text NOT NULL,
	`status` text NOT NULL,
	`token` text,
	`material` text DEFAULT 'client' NOT NULL,
	`geometry` text,
	`valid_until` text,
	`deposit_bps` integer,
	`start_text` text,
	`notes_for_client` text,
	`discount_bps` integer,
	`discount_gr` integer,
	`vat_bps` integer,
	`net_gr` integer,
	`vat_gr` integer,
	`gross_gr` integer,
	`missing_price_count` integer DEFAULT 0 NOT NULL,
	`send_channel` text,
	`ai_questions` text,
	`ai_answers` text,
	`ai_extraction` text,
	`prompt_version` text,
	`processing_error` text,
	`counted_for_plan_month` text,
	`sent_at` integer,
	`opened_at` integer,
	`accepted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `of_company_status` ON `offers` (`company_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `of_token` ON `offers` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `of_client_uuid` ON `offers` (`company_id`,`client_uuid`);--> statement-breakpoint
CREATE TABLE `price_list_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`source` text NOT NULL,
	`r2_key` text NOT NULL,
	`status` text NOT NULL,
	`result` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pli_imp_company` ON `price_list_imports` (`company_id`);--> statement-breakpoint
CREATE TABLE `price_list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`offer_name` text,
	`unit` text NOT NULL,
	`price_gr` integer NOT NULL,
	`measure` text NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`aliases` text DEFAULT '[]' NOT NULL,
	`includes_material` integer DEFAULT false NOT NULL,
	`source` text NOT NULL,
	`source_offer_id` text,
	`template_key` text,
	`archived_at` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pli_company` ON `price_list_items` (`company_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `pli_company_template` ON `price_list_items` (`company_id`,`template_key`);--> statement-breakpoint
CREATE TABLE `pricing_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`bps` integer,
	`amount_gr` integer,
	`threshold_milli` integer,
	`enabled` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pr_company` ON `pricing_rules` (`company_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `pr_company_kind` ON `pricing_rules` (`company_id`,`kind`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`keys` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ps_user` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ps_endpoint` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE TABLE `rate_limit` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`count` integer NOT NULL,
	`last_request` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rate_limit_key_unique` ON `rate_limit` (`key`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`offer_id` text NOT NULL,
	`kind` text NOT NULL,
	`due_at` integer NOT NULL,
	`done_at` integer,
	`snoozed_until` integer
);
--> statement-breakpoint
CREATE INDEX `re_company_due` ON `reminders` (`company_id`,`due_at`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_customer_id` text,
	`provider_subscription_id` text,
	`interval` text NOT NULL,
	`status` text NOT NULL,
	`current_period_end` integer
);
--> statement-breakpoint
CREATE INDEX `su_company` ON `subscriptions` (`company_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`phone_number` text,
	`phone_number_verified` integer,
	`company_id` text,
	`role` text DEFAULT 'owner' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_phone_number_unique` ON `user` (`phone_number`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier` ON `verification` (`identifier`);