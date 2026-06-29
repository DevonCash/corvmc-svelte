ALTER TABLE `event` ADD `recurring_series_id` text REFERENCES recurring_series(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `idx_event_recurring_series` ON `event` (`recurring_series_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_event_recurring_instance` ON `event` (`recurring_series_id`,`starts_at`) WHERE recurring_series_id IS NOT NULL AND status != 'cancelled';