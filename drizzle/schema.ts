import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const auditActionEnum = mysqlEnum("audit_action", [
  "created",
  "updated",
  "deleted",
  "approved",
  "rejected",
  "regenerated",
  "published",
  "failed",
  "cancelled",
  "review_requested",
]);

const automationModeEnum = mysqlEnum("automation_mode", [
  "full_review",
  "semi_auto",
  "conditional_auto",
]);

const confidenceEnum = mysqlEnum("confidence", ["low", "medium", "high"]);
const jobStatusEnum = mysqlEnum("job_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "retrying",
  "cancelled",
  "requires_review",
]);

const providerStatusEnum = mysqlEnum("provider_status", [
  "available",
  "limited",
  "degraded",
  "unconfigured",
  "mocked",
  "unavailable",
]);

const reviewStatusEnum = mysqlEnum("review_status", [
  "pending",
  "approved",
  "rejected",
  "requires_changes",
  "cancelled",
]);

const riskLevelEnum = mysqlEnum("risk_level", [
  "green",
  "yellow",
  "red",
  "requires_human_review",
]);

const videoStatusEnum = mysqlEnum("video_status", [
  "draft",
  "researching",
  "fact_checking",
  "scripting",
  "planning",
  "producing",
  "rendering",
  "quality_check",
  "awaiting_review",
  "approved",
  "scheduled",
  "published",
  "failed",
  "cancelled",
]);

const videoTypeEnum = mysqlEnum("video_type", ["short", "long_form"]);

export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    telegramUserId: varchar("telegramUserId", { length: 64 }),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: mysqlEnum("role", [
      "user",
      "admin",
      "editor",
      "fact_checker",
      "publisher",
      "viewer",
    ])
      .default("user")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  table => [uniqueIndex("users_telegram_user_id_unique").on(table.telegramUserId)]
);

export const projects = mysqlTable(
  "projects",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerUserId: int("ownerUserId").notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    description: text("description"),
    language: varchar("language", { length: 32 }).default("ar").notNull(),
    timezone: varchar("timezone", { length: 64 }).default("Africa/Cairo").notNull(),
    automationMode: automationModeEnum.default("full_review").notNull(),
    brandConfig: json("brandConfig").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("projects_owner_slug_unique").on(table.ownerUserId, table.slug),
    index("projects_owner_idx").on(table.ownerUserId),
  ]
);

export const ideas = mysqlTable(
  "ideas",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    centralIdea: text("centralIdea").notNull(),
    contentPillar: varchar("contentPillar", { length: 120 }).notNull(),
    targetFormat: videoTypeEnum.notNull(),
    hook: text("hook"),
    rationale: text("rationale"),
    status: reviewStatusEnum.default("pending").notNull(),
    riskLevel: riskLevelEnum.default("green").notNull(),
    confidence: confidenceEnum.default("medium").notNull(),
    score: int("score"),
    source: varchar("source", { length: 160 }).default("manual").notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("ideas_project_status_idx").on(table.projectId, table.status),
    index("ideas_project_score_idx").on(table.projectId, table.score),
  ]
);

export const videos = mysqlTable(
  "videos",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    ideaId: int("ideaId"),
    title: varchar("title", { length: 500 }).notNull(),
    videoType: videoTypeEnum.notNull(),
    status: videoStatusEnum.default("draft").notNull(),
    riskLevel: riskLevelEnum.default("green").notNull(),
    qualityScore: int("qualityScore"),
    targetDurationSeconds: int("targetDurationSeconds"),
    language: varchar("language", { length: 32 }).default("ar").notNull(),
    automationMode: automationModeEnum.default("full_review").notNull(),
    requiresHumanReview: boolean("requiresHumanReview").default(true).notNull(),
    safetyFlags: json("safetyFlags").$type<string[]>(),
    failureReason: text("failureReason"),
    publishedAt: timestamp("publishedAt"),
    scheduledFor: timestamp("scheduledFor"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("videos_project_status_idx").on(table.projectId, table.status),
    index("videos_idea_idx").on(table.ideaId),
    index("videos_schedule_idx").on(table.scheduledFor),
  ]
);

export const sources = mysqlTable(
  "sources",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    videoId: int("videoId"),
    title: varchar("title", { length: 500 }).notNull(),
    sourceUrl: varchar("sourceUrl", { length: 2048 }).notNull(),
    publisher: varchar("publisher", { length: 300 }),
    sourceType: varchar("sourceType", { length: 80 }).notNull(),
    publishedDate: timestamp("publishedDate"),
    accessedAt: timestamp("accessedAt").defaultNow().notNull(),
    excerpt: text("excerpt"),
    reliabilityScore: int("reliabilityScore"),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("sources_project_idx").on(table.projectId),
    index("sources_video_idx").on(table.videoId),
  ]
);

export const scripts = mysqlTable(
  "scripts",
  {
    id: int("id").autoincrement().primaryKey(),
    videoId: int("videoId").notNull(),
    version: int("version").default(1).notNull(),
    status: reviewStatusEnum.default("pending").notNull(),
    hook: text("hook"),
    body: text("body").notNull(),
    takeaway: text("takeaway"),
    estimatedDurationSeconds: int("estimatedDurationSeconds"),
    sourceNotes: json("sourceNotes").$type<Record<string, unknown>>(),
    generatedBy: varchar("generatedBy", { length: 160 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("scripts_video_version_unique").on(table.videoId, table.version)]
);

export const claims = mysqlTable(
  "claims",
  {
    id: int("id").autoincrement().primaryKey(),
    videoId: int("videoId").notNull(),
    scriptId: int("scriptId"),
    sourceId: int("sourceId"),
    claimText: text("claimText").notNull(),
    evidence: text("evidence"),
    confidence: confidenceEnum.default("medium").notNull(),
    riskLevel: riskLevelEnum.default("green").notNull(),
    verificationStatus: reviewStatusEnum.default("pending").notNull(),
    checkedAt: timestamp("checkedAt"),
    reviewerNotes: text("reviewerNotes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("claims_video_status_idx").on(table.videoId, table.verificationStatus),
    index("claims_source_idx").on(table.sourceId),
  ]
);

export const scenes = mysqlTable(
  "scenes",
  {
    id: int("id").autoincrement().primaryKey(),
    videoId: int("videoId").notNull(),
    scriptId: int("scriptId"),
    sequence: int("sequence").notNull(),
    startTimeMs: int("startTimeMs").notNull(),
    endTimeMs: int("endTimeMs").notNull(),
    narration: text("narration"),
    visualType: varchar("visualType", { length: 80 }).notNull(),
    visualAssetId: int("visualAssetId"),
    motion: json("motion").$type<Record<string, unknown>>(),
    transition: json("transition").$type<Record<string, unknown>>(),
    sfxCue: json("sfxCue").$type<Record<string, unknown>>(),
    caption: text("caption"),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("scenes_video_sequence_unique").on(table.videoId, table.sequence),
    index("scenes_video_timing_idx").on(table.videoId, table.startTimeMs),
  ]
);

export const assets = mysqlTable(
  "assets",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    videoId: int("videoId"),
    assetType: varchar("assetType", { length: 80 }).notNull(),
    label: varchar("label", { length: 300 }).notNull(),
    storageKey: varchar("storageKey", { length: 1024 }),
    publicUrl: varchar("publicUrl", { length: 2048 }),
    provider: varchar("provider", { length: 160 }),
    sourceUrl: varchar("sourceUrl", { length: 2048 }),
    licenseType: varchar("licenseType", { length: 160 }),
    commercialUsageStatus: reviewStatusEnum.default("pending").notNull(),
    attributionRequirement: text("attributionRequirement"),
    provenanceStatus: reviewStatusEnum.default("pending").notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("assets_project_type_idx").on(table.projectId, table.assetType),
    index("assets_video_idx").on(table.videoId),
  ]
);

export const assetLicenses = mysqlTable(
  "asset_licenses",
  {
    id: int("id").autoincrement().primaryKey(),
    assetId: int("assetId").notNull(),
    licenseName: varchar("licenseName", { length: 240 }).notNull(),
    licenseUrl: varchar("licenseUrl", { length: 2048 }),
    verifiedAt: timestamp("verifiedAt"),
    commercialUseAllowed: boolean("commercialUseAllowed").default(false).notNull(),
    modificationAllowed: boolean("modificationAllowed").default(false).notNull(),
    reviewerNotes: text("reviewerNotes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("asset_licenses_asset_idx").on(table.assetId)]
);

export const audioTracks = mysqlTable(
  "audio_tracks",
  {
    id: int("id").autoincrement().primaryKey(),
    videoId: int("videoId").notNull(),
    sceneId: int("sceneId"),
    audioType: varchar("audioType", { length: 60 }).notNull(),
    provider: varchar("provider", { length: 160 }),
    voiceId: varchar("voiceId", { length: 160 }),
    storageKey: varchar("storageKey", { length: 1024 }),
    publicUrl: varchar("publicUrl", { length: 2048 }),
    durationMs: int("durationMs"),
    isMusicLike: boolean("isMusicLike").default(false).notNull(),
    reviewStatus: reviewStatusEnum.default("pending").notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("audio_tracks_video_idx").on(table.videoId)]
);

export const renders = mysqlTable(
  "renders",
  {
    id: int("id").autoincrement().primaryKey(),
    videoId: int("videoId").notNull(),
    status: jobStatusEnum.default("queued").notNull(),
    renderProvider: varchar("renderProvider", { length: 160 }),
    storageKey: varchar("storageKey", { length: 1024 }),
    publicUrl: varchar("publicUrl", { length: 2048 }),
    durationSeconds: int("durationSeconds"),
    width: int("width"),
    height: int("height"),
    errorDetail: text("errorDetail"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("renders_video_status_idx").on(table.videoId, table.status)]
);

export const thumbnails = mysqlTable(
  "thumbnails",
  {
    id: int("id").autoincrement().primaryKey(),
    videoId: int("videoId").notNull(),
    status: reviewStatusEnum.default("pending").notNull(),
    storageKey: varchar("storageKey", { length: 1024 }),
    publicUrl: varchar("publicUrl", { length: 2048 }),
    concept: text("concept"),
    altText: text("altText"),
    provider: varchar("provider", { length: 160 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("thumbnails_video_idx").on(table.videoId)]
);

export const videoMetadata = mysqlTable(
  "video_metadata",
  {
    id: int("id").autoincrement().primaryKey(),
    videoId: int("videoId").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    hashtags: json("hashtags").$type<string[]>(),
    tags: json("tags").$type<string[]>(),
    category: varchar("category", { length: 120 }),
    visibility: varchar("visibility", { length: 40 }).default("private").notNull(),
    youtubeVideoId: varchar("youtubeVideoId", { length: 128 }),
    youtubeUrl: varchar("youtubeUrl", { length: 2048 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("video_metadata_video_unique").on(table.videoId),
    uniqueIndex("video_metadata_youtube_unique").on(table.youtubeVideoId),
  ]
);

export const providers = mysqlTable(
  "providers",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    providerType: varchar("providerType", { length: 80 }).notNull(),
    adapterKey: varchar("adapterKey", { length: 160 }).notNull(),
    displayName: varchar("displayName", { length: 240 }).notNull(),
    status: providerStatusEnum.default("unconfigured").notNull(),
    isEnabled: boolean("isEnabled").default(false).notNull(),
    isFallback: boolean("isFallback").default(false).notNull(),
    freeTierStatus: varchar("freeTierStatus", { length: 80 }).notNull(),
    capabilityNotes: text("capabilityNotes"),
    configuration: json("configuration").$type<Record<string, unknown>>(),
    lastHealthCheckAt: timestamp("lastHealthCheckAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("providers_project_adapter_unique").on(table.projectId, table.adapterKey),
    index("providers_project_type_idx").on(table.projectId, table.providerType),
  ]
);

export const jobs = mysqlTable(
  "jobs",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    videoId: int("videoId"),
    jobType: varchar("jobType", { length: 120 }).notNull(),
    status: jobStatusEnum.default("queued").notNull(),
    priority: int("priority").default(0).notNull(),
    providerAdapterKey: varchar("providerAdapterKey", { length: 160 }),
    payload: json("payload").$type<Record<string, unknown>>(),
    result: json("result").$type<Record<string, unknown>>(),
    attemptCount: int("attemptCount").default(0).notNull(),
    maxAttempts: int("maxAttempts").default(3).notNull(),
    timeoutSeconds: int("timeoutSeconds").default(120).notNull(),
    availableAt: timestamp("availableAt").defaultNow().notNull(),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    failureReason: text("failureReason"),
    requiresHumanReview: boolean("requiresHumanReview").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("jobs_project_status_available_idx").on(table.projectId, table.status, table.availableAt),
    index("jobs_video_idx").on(table.videoId),
  ]
);

export const jobLogs = mysqlTable(
  "job_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    jobId: int("jobId").notNull(),
    level: varchar("level", { length: 20 }).notNull(),
    message: text("message").notNull(),
    context: json("context").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("job_logs_job_created_idx").on(table.jobId, table.createdAt)]
);

export const settings = mysqlTable(
  "settings",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    key: varchar("key", { length: 160 }).notNull(),
    value: json("value").$type<unknown>(),
    isSecretReference: boolean("isSecretReference").default(false).notNull(),
    updatedByUserId: int("updatedByUserId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("settings_project_key_unique").on(table.projectId, table.key)]
);

export const approvals = mysqlTable(
  "approvals",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    videoId: int("videoId").notNull(),
    approvalType: varchar("approvalType", { length: 100 }).notNull(),
    status: reviewStatusEnum.default("pending").notNull(),
    requestedBy: varchar("requestedBy", { length: 120 }).notNull(),
    decidedByUserId: int("decidedByUserId"),
    decisionNotes: text("decisionNotes"),
    decisionPayload: json("decisionPayload").$type<Record<string, unknown>>(),
    decidedAt: timestamp("decidedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("approvals_video_status_idx").on(table.videoId, table.status)]
);

export const youtubeChannels = mysqlTable(
  "youtube_channels",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    channelId: varchar("channelId", { length: 128 }).notNull(),
    channelTitle: varchar("channelTitle", { length: 300 }),
    oauthSecretRef: varchar("oauthSecretRef", { length: 160 }),
    isConnected: boolean("isConnected").default(false).notNull(),
    lastSyncedAt: timestamp("lastSyncedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("youtube_channels_channel_unique").on(table.channelId),
    index("youtube_channels_project_idx").on(table.projectId),
  ]
);

export const youtubeOAuthTokens = mysqlTable(
  "youtube_oauth_tokens",
  {
    id: int("id").autoincrement().primaryKey(),
    youtubeChannelId: int("youtubeChannelId").notNull(),
    accessTokenCiphertext: text("accessTokenCiphertext").notNull(),
    refreshTokenCiphertext: text("refreshTokenCiphertext").notNull(),
    iv: varchar("iv", { length: 64 }).notNull(),
    authTag: varchar("authTag", { length: 64 }).notNull(),
    scope: text("scope"),
    expiresAt: timestamp("expiresAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("youtube_oauth_tokens_channel_unique").on(table.youtubeChannelId)]
);

export const analyticsSnapshots = mysqlTable(
  "analytics_snapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    videoId: int("videoId"),
    youtubeChannelId: int("youtubeChannelId"),
    periodStart: timestamp("periodStart").notNull(),
    periodEnd: timestamp("periodEnd").notNull(),
    views: int("views").default(0).notNull(),
    impressions: int("impressions").default(0).notNull(),
    ctrBasisPoints: int("ctrBasisPoints"),
    watchTimeMinutes: int("watchTimeMinutes").default(0).notNull(),
    averageViewDurationSeconds: int("averageViewDurationSeconds"),
    retentionPercent: int("retentionPercent"),
    subscribersGained: int("subscribersGained").default(0).notNull(),
    likes: int("likes").default(0).notNull(),
    comments: int("comments").default(0).notNull(),
    shares: int("shares").default(0).notNull(),
    rawMetrics: json("rawMetrics").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("analytics_project_period_idx").on(table.projectId, table.periodStart),
    index("analytics_video_period_idx").on(table.videoId, table.periodStart),
  ]
);

export const schedules = mysqlTable(
  "schedules",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    name: varchar("name", { length: 240 }).notNull(),
    cronExpression: varchar("cronExpression", { length: 100 }).notNull(),
    timezone: varchar("timezone", { length: 64 }).notNull(),
    scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
    taskType: varchar("taskType", { length: 120 }).notNull(),
    isEnabled: boolean("isEnabled").default(false).notNull(),
    configuration: json("configuration").$type<Record<string, unknown>>(),
    lastRunAt: timestamp("lastRunAt"),
    nextRunAt: timestamp("nextRunAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("schedules_task_uid_unique").on(table.scheduleCronTaskUid),
    index("schedules_project_enabled_idx").on(table.projectId, table.isEnabled),
  ]
);

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(),
    actorUserId: int("actorUserId"),
    actorType: varchar("actorType", { length: 40 }).notNull(),
    action: auditActionEnum.notNull(),
    entityType: varchar("entityType", { length: 120 }).notNull(),
    entityId: varchar("entityId", { length: 120 }).notNull(),
    summary: text("summary").notNull(),
    context: json("context").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("audit_logs_project_created_idx").on(table.projectId, table.createdAt),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  ]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type Video = typeof videos.$inferSelect;
export type Job = typeof jobs.$inferSelect;
