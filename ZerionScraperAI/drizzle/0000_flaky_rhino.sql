CREATE TABLE `audits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` integer NOT NULL,
	`http_status` integer,
	`site_up` integer,
	`parked` integer,
	`ssl_ok` integer,
	`ssl_expires_at` integer,
	`copyright_year` integer,
	`analytics_detected` integer,
	`detected_language` text,
	`mobile_usable` integer,
	`ctas` text,
	`dead_socials` text,
	`broken_links_count` integer,
	`page_weight_kb` integer,
	`screenshot_path` text,
	`psi_performance` integer,
	`lcp_ms` integer,
	`raw` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `audits_lead_uq` ON `audits` (`lead_id`);--> statement-breakpoint
CREATE TABLE `costs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` integer,
	`run_id` integer,
	`stage` text NOT NULL,
	`provider` text NOT NULL,
	`amount_usd` real NOT NULL,
	`meta` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `costs_run_idx` ON `costs` (`run_id`);--> statement-breakpoint
CREATE INDEX `costs_lead_idx` ON `costs` (`lead_id`);--> statement-breakpoint
CREATE TABLE `findings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` integer NOT NULL,
	`type` text NOT NULL,
	`hook_rank` integer NOT NULL,
	`claim_es` text NOT NULL,
	`claim_en` text NOT NULL,
	`evidence` text NOT NULL,
	`verified_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `findings_lead_idx` ON `findings` (`lead_id`);--> statement-breakpoint
CREATE TABLE `lead_emails` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` integer NOT NULL,
	`email` text NOT NULL,
	`source` text NOT NULL,
	`verification_status` text DEFAULT 'unverified' NOT NULL,
	`grade` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`verified_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lead_emails_lead_email_uq` ON `lead_emails` (`lead_id`,`email`);--> statement-breakpoint
CREATE INDEX `lead_emails_lead_idx` ON `lead_emails` (`lead_id`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` integer NOT NULL,
	`first_run_id` integer NOT NULL,
	`place_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`address` text,
	`city` text,
	`phone` text,
	`normalized_phone` text,
	`website_url` text,
	`normalized_domain` text,
	`google_rating` real,
	`review_count` integer,
	`language` text,
	`what_they_do` text,
	`decision_maker_name` text,
	`social_links` text,
	`whatsapp_phone` text,
	`segment` text DEFAULT 'unknown' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`score` integer,
	`score_reasons` text,
	`error_message` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`first_run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leads_place_id_uq` ON `leads` (`place_id`);--> statement-breakpoint
CREATE INDEX `leads_domain_idx` ON `leads` (`normalized_domain`);--> statement-breakpoint
CREATE INDEX `leads_phone_idx` ON `leads` (`normalized_phone`);--> statement-breakpoint
CREATE INDEX `leads_status_idx` ON `leads` (`status`);--> statement-breakpoint
CREATE INDEX `leads_profile_idx` ON `leads` (`profile_id`);--> statement-breakpoint
CREATE INDEX `leads_score_idx` ON `leads` (`score`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`industry` text NOT NULL,
	`geos` text NOT NULL,
	`language` text DEFAULT 'auto' NOT NULL,
	`filters` text DEFAULT '{}' NOT NULL,
	`leads_per_day` integer DEFAULT 50 NOT NULL,
	`instantly_campaign_id` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_name_unique` ON `profiles` (`name`);--> statement-breakpoint
CREATE TABLE `pushes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` integer NOT NULL,
	`method` text NOT NULL,
	`campaign_id` text,
	`status` text NOT NULL,
	`instantly_lead_id` text,
	`error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `pushes_lead_idx` ON `pushes` (`lead_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` integer NOT NULL,
	`author` text,
	`rating` integer,
	`text` text,
	`review_date` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reviews_lead_idx` ON `reviews` (`lead_id`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` integer NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`leads_requested` integer DEFAULT 0 NOT NULL,
	`leads_fetched` integer DEFAULT 0 NOT NULL,
	`leads_new` integer DEFAULT 0 NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `runs_profile_idx` ON `runs` (`profile_id`);--> statement-breakpoint
CREATE TABLE `suppression` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `suppression_email_unique` ON `suppression` (`email`);--> statement-breakpoint
CREATE TABLE `variables` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` integer NOT NULL,
	`first_line` text NOT NULL,
	`pain_point` text NOT NULL,
	`ps_line` text,
	`language` text NOT NULL,
	`source_finding_ids` text NOT NULL,
	`model` text NOT NULL,
	`approved` integer DEFAULT false NOT NULL,
	`edited_by_founder` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `variables_lead_uq` ON `variables` (`lead_id`);