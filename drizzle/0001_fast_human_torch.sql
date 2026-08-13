CREATE TABLE `analytics_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`videoId` int,
	`youtubeChannelId` int,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`views` int NOT NULL DEFAULT 0,
	`impressions` int NOT NULL DEFAULT 0,
	`ctrBasisPoints` int,
	`watchTimeMinutes` int NOT NULL DEFAULT 0,
	`averageViewDurationSeconds` int,
	`retentionPercent` int,
	`subscribersGained` int NOT NULL DEFAULT 0,
	`likes` int NOT NULL DEFAULT 0,
	`comments` int NOT NULL DEFAULT 0,
	`shares` int NOT NULL DEFAULT 0,
	`rawMetrics` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analytics_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`videoId` int NOT NULL,
	`approvalType` varchar(100) NOT NULL,
	`review_status` enum('pending','approved','rejected','requires_changes','cancelled') NOT NULL DEFAULT 'pending',
	`requestedBy` varchar(120) NOT NULL,
	`decidedByUserId` int,
	`decisionNotes` text,
	`decisionPayload` json,
	`decidedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `asset_licenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int NOT NULL,
	`licenseName` varchar(240) NOT NULL,
	`licenseUrl` varchar(2048),
	`verifiedAt` timestamp,
	`commercialUseAllowed` boolean NOT NULL DEFAULT false,
	`modificationAllowed` boolean NOT NULL DEFAULT false,
	`reviewerNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `asset_licenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`videoId` int,
	`assetType` varchar(80) NOT NULL,
	`label` varchar(300) NOT NULL,
	`storageKey` varchar(1024),
	`publicUrl` varchar(2048),
	`provider` varchar(160),
	`sourceUrl` varchar(2048),
	`licenseType` varchar(160),
	`review_status` enum('pending','approved','rejected','requires_changes','cancelled') NOT NULL DEFAULT 'pending',
	`attributionRequirement` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audio_tracks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`videoId` int NOT NULL,
	`sceneId` int,
	`audioType` varchar(60) NOT NULL,
	`provider` varchar(160),
	`voiceId` varchar(160),
	`storageKey` varchar(1024),
	`publicUrl` varchar(2048),
	`durationMs` int,
	`isMusicLike` boolean NOT NULL DEFAULT false,
	`review_status` enum('pending','approved','rejected','requires_changes','cancelled') NOT NULL DEFAULT 'pending',
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audio_tracks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`actorUserId` int,
	`actorType` varchar(40) NOT NULL,
	`audit_action` enum('created','updated','deleted','approved','rejected','regenerated','published','failed','cancelled','review_requested') NOT NULL,
	`entityType` varchar(120) NOT NULL,
	`entityId` varchar(120) NOT NULL,
	`summary` text NOT NULL,
	`context` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `claims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`videoId` int NOT NULL,
	`scriptId` int,
	`sourceId` int,
	`claimText` text NOT NULL,
	`evidence` text,
	`confidence` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`risk_level` enum('green','yellow','red','requires_human_review') NOT NULL DEFAULT 'green',
	`review_status` enum('pending','approved','rejected','requires_changes','cancelled') NOT NULL DEFAULT 'pending',
	`checkedAt` timestamp,
	`reviewerNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `claims_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ideas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`centralIdea` text NOT NULL,
	`contentPillar` varchar(120) NOT NULL,
	`video_type` enum('short','long_form') NOT NULL,
	`hook` text,
	`rationale` text,
	`review_status` enum('pending','approved','rejected','requires_changes','cancelled') NOT NULL DEFAULT 'pending',
	`risk_level` enum('green','yellow','red','requires_human_review') NOT NULL DEFAULT 'green',
	`confidence` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`score` int,
	`source` varchar(160) NOT NULL DEFAULT 'manual',
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ideas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`level` varchar(20) NOT NULL,
	`message` text NOT NULL,
	`context` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `job_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`videoId` int,
	`jobType` varchar(120) NOT NULL,
	`job_status` enum('queued','running','completed','failed','retrying','cancelled','requires_review') NOT NULL DEFAULT 'queued',
	`priority` int NOT NULL DEFAULT 0,
	`providerAdapterKey` varchar(160),
	`payload` json,
	`result` json,
	`attemptCount` int NOT NULL DEFAULT 0,
	`maxAttempts` int NOT NULL DEFAULT 3,
	`timeoutSeconds` int NOT NULL DEFAULT 120,
	`availableAt` timestamp NOT NULL DEFAULT (now()),
	`startedAt` timestamp,
	`completedAt` timestamp,
	`failureReason` text,
	`requiresHumanReview` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`description` text,
	`language` varchar(32) NOT NULL DEFAULT 'ar',
	`timezone` varchar(64) NOT NULL DEFAULT 'Africa/Cairo',
	`automation_mode` enum('full_review','semi_auto','conditional_auto') NOT NULL DEFAULT 'full_review',
	`brandConfig` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_owner_slug_unique` UNIQUE(`ownerUserId`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `providers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`providerType` varchar(80) NOT NULL,
	`adapterKey` varchar(160) NOT NULL,
	`displayName` varchar(240) NOT NULL,
	`provider_status` enum('available','limited','degraded','unconfigured','mocked','unavailable') NOT NULL DEFAULT 'unconfigured',
	`isEnabled` boolean NOT NULL DEFAULT false,
	`isFallback` boolean NOT NULL DEFAULT false,
	`freeTierStatus` varchar(80) NOT NULL,
	`capabilityNotes` text,
	`configuration` json,
	`lastHealthCheckAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `providers_id` PRIMARY KEY(`id`),
	CONSTRAINT `providers_project_adapter_unique` UNIQUE(`projectId`,`adapterKey`)
);
--> statement-breakpoint
CREATE TABLE `renders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`videoId` int NOT NULL,
	`job_status` enum('queued','running','completed','failed','retrying','cancelled','requires_review') NOT NULL DEFAULT 'queued',
	`renderProvider` varchar(160),
	`storageKey` varchar(1024),
	`publicUrl` varchar(2048),
	`durationSeconds` int,
	`width` int,
	`height` int,
	`errorDetail` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `renders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scenes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`videoId` int NOT NULL,
	`scriptId` int,
	`sequence` int NOT NULL,
	`startTimeMs` int NOT NULL,
	`endTimeMs` int NOT NULL,
	`narration` text,
	`visualType` varchar(80) NOT NULL,
	`visualAssetId` int,
	`motion` json,
	`transition` json,
	`sfxCue` json,
	`caption` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scenes_id` PRIMARY KEY(`id`),
	CONSTRAINT `scenes_video_sequence_unique` UNIQUE(`videoId`,`sequence`)
);
--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(240) NOT NULL,
	`cronExpression` varchar(100) NOT NULL,
	`timezone` varchar(64) NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`taskType` varchar(120) NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT false,
	`configuration` json,
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `schedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `schedules_task_uid_unique` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
CREATE TABLE `scripts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`videoId` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`review_status` enum('pending','approved','rejected','requires_changes','cancelled') NOT NULL DEFAULT 'pending',
	`hook` text,
	`body` text NOT NULL,
	`takeaway` text,
	`estimatedDurationSeconds` int,
	`sourceNotes` json,
	`generatedBy` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scripts_id` PRIMARY KEY(`id`),
	CONSTRAINT `scripts_video_version_unique` UNIQUE(`videoId`,`version`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`key` varchar(160) NOT NULL,
	`value` json,
	`isSecretReference` boolean NOT NULL DEFAULT false,
	`updatedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `settings_project_key_unique` UNIQUE(`projectId`,`key`)
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`videoId` int,
	`title` varchar(500) NOT NULL,
	`sourceUrl` varchar(2048) NOT NULL,
	`publisher` varchar(300),
	`sourceType` varchar(80) NOT NULL,
	`publishedDate` timestamp,
	`accessedAt` timestamp NOT NULL DEFAULT (now()),
	`excerpt` text,
	`reliabilityScore` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `thumbnails` (
	`id` int AUTO_INCREMENT NOT NULL,
	`videoId` int NOT NULL,
	`review_status` enum('pending','approved','rejected','requires_changes','cancelled') NOT NULL DEFAULT 'pending',
	`storageKey` varchar(1024),
	`publicUrl` varchar(2048),
	`concept` text,
	`altText` text,
	`provider` varchar(160),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `thumbnails_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `video_metadata` (
	`id` int AUTO_INCREMENT NOT NULL,
	`videoId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`hashtags` json,
	`tags` json,
	`category` varchar(120),
	`visibility` varchar(40) NOT NULL DEFAULT 'private',
	`youtubeVideoId` varchar(128),
	`youtubeUrl` varchar(2048),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `video_metadata_id` PRIMARY KEY(`id`),
	CONSTRAINT `video_metadata_video_unique` UNIQUE(`videoId`),
	CONSTRAINT `video_metadata_youtube_unique` UNIQUE(`youtubeVideoId`)
);
--> statement-breakpoint
CREATE TABLE `videos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`ideaId` int,
	`title` varchar(500) NOT NULL,
	`video_type` enum('short','long_form') NOT NULL,
	`video_status` enum('draft','researching','fact_checking','scripting','planning','producing','rendering','quality_check','awaiting_review','approved','scheduled','published','failed','cancelled') NOT NULL DEFAULT 'draft',
	`risk_level` enum('green','yellow','red','requires_human_review') NOT NULL DEFAULT 'green',
	`qualityScore` int,
	`targetDurationSeconds` int,
	`language` varchar(32) NOT NULL DEFAULT 'ar',
	`automation_mode` enum('full_review','semi_auto','conditional_auto') NOT NULL DEFAULT 'full_review',
	`requiresHumanReview` boolean NOT NULL DEFAULT true,
	`safetyFlags` json,
	`failureReason` text,
	`publishedAt` timestamp,
	`scheduledFor` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `videos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `youtube_channels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`channelId` varchar(128) NOT NULL,
	`channelTitle` varchar(300),
	`oauthSecretRef` varchar(160),
	`isConnected` boolean NOT NULL DEFAULT false,
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `youtube_channels_id` PRIMARY KEY(`id`),
	CONSTRAINT `youtube_channels_channel_unique` UNIQUE(`channelId`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','editor','fact_checker','publisher','viewer') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `telegramUserId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_telegram_user_id_unique` UNIQUE(`telegramUserId`);--> statement-breakpoint
CREATE INDEX `analytics_project_period_idx` ON `analytics_snapshots` (`projectId`,`periodStart`);--> statement-breakpoint
CREATE INDEX `analytics_video_period_idx` ON `analytics_snapshots` (`videoId`,`periodStart`);--> statement-breakpoint
CREATE INDEX `approvals_video_status_idx` ON `approvals` (`videoId`,`review_status`);--> statement-breakpoint
CREATE INDEX `asset_licenses_asset_idx` ON `asset_licenses` (`assetId`);--> statement-breakpoint
CREATE INDEX `assets_project_type_idx` ON `assets` (`projectId`,`assetType`);--> statement-breakpoint
CREATE INDEX `assets_video_idx` ON `assets` (`videoId`);--> statement-breakpoint
CREATE INDEX `audio_tracks_video_idx` ON `audio_tracks` (`videoId`);--> statement-breakpoint
CREATE INDEX `audit_logs_project_created_idx` ON `audit_logs` (`projectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `claims_video_status_idx` ON `claims` (`videoId`,`review_status`);--> statement-breakpoint
CREATE INDEX `claims_source_idx` ON `claims` (`sourceId`);--> statement-breakpoint
CREATE INDEX `ideas_project_status_idx` ON `ideas` (`projectId`,`review_status`);--> statement-breakpoint
CREATE INDEX `ideas_project_score_idx` ON `ideas` (`projectId`,`score`);--> statement-breakpoint
CREATE INDEX `job_logs_job_created_idx` ON `job_logs` (`jobId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `jobs_project_status_available_idx` ON `jobs` (`projectId`,`job_status`,`availableAt`);--> statement-breakpoint
CREATE INDEX `jobs_video_idx` ON `jobs` (`videoId`);--> statement-breakpoint
CREATE INDEX `projects_owner_idx` ON `projects` (`ownerUserId`);--> statement-breakpoint
CREATE INDEX `providers_project_type_idx` ON `providers` (`projectId`,`providerType`);--> statement-breakpoint
CREATE INDEX `renders_video_status_idx` ON `renders` (`videoId`,`job_status`);--> statement-breakpoint
CREATE INDEX `scenes_video_timing_idx` ON `scenes` (`videoId`,`startTimeMs`);--> statement-breakpoint
CREATE INDEX `schedules_project_enabled_idx` ON `schedules` (`projectId`,`isEnabled`);--> statement-breakpoint
CREATE INDEX `sources_project_idx` ON `sources` (`projectId`);--> statement-breakpoint
CREATE INDEX `sources_video_idx` ON `sources` (`videoId`);--> statement-breakpoint
CREATE INDEX `thumbnails_video_idx` ON `thumbnails` (`videoId`);--> statement-breakpoint
CREATE INDEX `videos_project_status_idx` ON `videos` (`projectId`,`video_status`);--> statement-breakpoint
CREATE INDEX `videos_idea_idx` ON `videos` (`ideaId`);--> statement-breakpoint
CREATE INDEX `videos_schedule_idx` ON `videos` (`scheduledFor`);--> statement-breakpoint
CREATE INDEX `youtube_channels_project_idx` ON `youtube_channels` (`projectId`);