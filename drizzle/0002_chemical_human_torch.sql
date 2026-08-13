CREATE TABLE `youtube_oauth_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`youtubeChannelId` int NOT NULL,
	`accessTokenCiphertext` text NOT NULL,
	`refreshTokenCiphertext` text NOT NULL,
	`iv` varchar(64) NOT NULL,
	`authTag` varchar(64) NOT NULL,
	`scope` text,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `youtube_oauth_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `youtube_oauth_tokens_channel_unique` UNIQUE(`youtubeChannelId`)
);
