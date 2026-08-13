import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { NUSGH_BRAND } from "../../shared/nusgh";
import { enqueueJob } from "./queue";
import {
  createAuditEntry,
  createIdea,
  createVideoFromIdea,
  ensureNusghProject,
  getDashboardSnapshot,
  listProjectJobs,
  listProjectProviders,
  listProjectVideos,
} from "./repository";

async function projectForCaller(userId: number) {
  return ensureNusghProject(userId);
}

export const nusghRouter = router({
  bootstrap: adminProcedure.mutation(async ({ ctx }) => {
    const project = await projectForCaller(ctx.user.id);
    return { project, brand: NUSGH_BRAND };
  }),
  dashboard: adminProcedure.query(async ({ ctx }) => {
    const project = await projectForCaller(ctx.user.id);
    return { project, snapshot: await getDashboardSnapshot(project.id), brand: NUSGH_BRAND };
  }),
  videos: adminProcedure.query(async ({ ctx }) => {
    const project = await projectForCaller(ctx.user.id);
    return listProjectVideos(project.id);
  }),
  jobs: adminProcedure.query(async ({ ctx }) => {
    const project = await projectForCaller(ctx.user.id);
    return listProjectJobs(project.id);
  }),
  providers: adminProcedure.query(async ({ ctx }) => {
    const project = await projectForCaller(ctx.user.id);
    return listProjectProviders(project.id);
  }),
  createIdea: adminProcedure
    .input(
      z.object({
        title: z.string().min(8).max(500),
        centralIdea: z.string().min(30).max(5000),
        contentPillar: z.string().min(3).max(120),
        targetFormat: z.enum(["short", "long_form"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await projectForCaller(ctx.user.id);
      const idea = await createIdea({ projectId: project.id, ...input });
      if (!idea) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إنشاء الفكرة." });
      await createAuditEntry({
        projectId: project.id,
        actorUserId: ctx.user.id,
        actorType: "owner",
        action: "created",
        entityType: "idea",
        entityId: String(idea.id),
        summary: "أُنشئت فكرة جديدة يدويًا.",
      });
      return idea;
    }),
  createVideo: adminProcedure
    .input(
      z.object({
        ideaId: z.number().int().positive(),
        title: z.string().min(8).max(500),
        videoType: z.enum(["short", "long_form"]),
        targetDurationSeconds: z.number().int().min(20).max(3600),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const project = await projectForCaller(ctx.user.id);
      const video = await createVideoFromIdea({ projectId: project.id, ...input });
      if (!video) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إنشاء الفيديو." });
      const job = await enqueueJob({
        projectId: project.id,
        videoId: video.id,
        jobType: "pipeline.initialize",
        payload: { stage: "idea", videoId: video.id },
      });
      await createAuditEntry({
        projectId: project.id,
        actorUserId: ctx.user.id,
        actorType: "owner",
        action: "created",
        entityType: "video",
        entityId: String(video.id),
        summary: "أنشئ فيديو جديد وأضيفت أول مهمة إلى الطابور.",
        context: { jobId: job.id },
      });
      return { video, job };
    }),
});
