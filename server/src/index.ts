import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createVideoInputSchema,
  updateVideoStatusInputSchema,
  createTranslationJobInputSchema,
  updateTranslationJobInputSchema,
  createAudioGenerationJobInputSchema,
  updateAudioGenerationJobInputSchema,
  createFinalOutputInputSchema,
  getVideosQuerySchema,
  getTranslationJobsQuerySchema
} from './schema';

// Import handlers
import { createVideo } from './handlers/create_video';
import { getVideos } from './handlers/get_videos';
import { getVideoById } from './handlers/get_video_by_id';
import { updateVideoStatus } from './handlers/update_video_status';
import { createTranslationJob } from './handlers/create_translation_job';
import { getTranslationJobs } from './handlers/get_translation_jobs';
import { updateTranslationJob } from './handlers/update_translation_job';
import { createAudioGenerationJob } from './handlers/create_audio_generation_job';
import { updateAudioGenerationJob } from './handlers/update_audio_generation_job';
import { createFinalOutput } from './handlers/create_final_output';
import { getFinalOutputs } from './handlers/get_final_outputs';
import { getFinalOutputByVideoId } from './handlers/get_final_output_by_video_id';
import { getTranslationWorkflowStatus } from './handlers/get_translation_workflow_status';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Video management routes
  createVideo: publicProcedure
    .input(createVideoInputSchema)
    .mutation(({ input }) => createVideo(input)),
  
  getVideos: publicProcedure
    .input(getVideosQuerySchema.optional())
    .query(({ input }) => getVideos(input)),
  
  getVideoById: publicProcedure
    .input(z.number())
    .query(({ input }) => getVideoById(input)),
  
  updateVideoStatus: publicProcedure
    .input(updateVideoStatusInputSchema)
    .mutation(({ input }) => updateVideoStatus(input)),

  // Translation job routes
  createTranslationJob: publicProcedure
    .input(createTranslationJobInputSchema)
    .mutation(({ input }) => createTranslationJob(input)),
  
  getTranslationJobs: publicProcedure
    .input(getTranslationJobsQuerySchema.optional())
    .query(({ input }) => getTranslationJobs(input)),
  
  updateTranslationJob: publicProcedure
    .input(updateTranslationJobInputSchema)
    .mutation(({ input }) => updateTranslationJob(input)),

  // Audio generation job routes
  createAudioGenerationJob: publicProcedure
    .input(createAudioGenerationJobInputSchema)
    .mutation(({ input }) => createAudioGenerationJob(input)),
  
  updateAudioGenerationJob: publicProcedure
    .input(updateAudioGenerationJobInputSchema)
    .mutation(({ input }) => updateAudioGenerationJob(input)),

  // Final output routes
  createFinalOutput: publicProcedure
    .input(createFinalOutputInputSchema)
    .mutation(({ input }) => createFinalOutput(input)),
  
  getFinalOutputs: publicProcedure
    .query(() => getFinalOutputs()),
  
  getFinalOutputByVideoId: publicProcedure
    .input(z.number())
    .query(({ input }) => getFinalOutputByVideoId(input)),

  // Workflow status route
  getTranslationWorkflowStatus: publicProcedure
    .input(z.number())
    .query(({ input }) => getTranslationWorkflowStatus(input)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();