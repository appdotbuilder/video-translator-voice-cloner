import { db } from '../db';
import { finalOutputsTable, videosTable, translationJobsTable, audioGenerationJobsTable } from '../db/schema';
import { type FinalOutput } from '../schema';
import { eq, desc } from 'drizzle-orm';

export interface GetFinalOutputsOptions {
  limit?: number;
  offset?: number;
  includeRelations?: boolean;
}

export const getFinalOutputs = async (options: GetFinalOutputsOptions = {}): Promise<FinalOutput[]> => {
  try {
    const { limit = 10, offset = 0, includeRelations = false } = options;

    if (includeRelations) {
      // Handle joined query separately
      const results = await db.select()
        .from(finalOutputsTable)
        .innerJoin(videosTable, eq(finalOutputsTable.video_id, videosTable.id))
        .innerJoin(translationJobsTable, eq(finalOutputsTable.translation_job_id, translationJobsTable.id))
        .innerJoin(audioGenerationJobsTable, eq(finalOutputsTable.audio_generation_job_id, audioGenerationJobsTable.id))
        .orderBy(desc(finalOutputsTable.created_at))
        .limit(limit)
        .offset(offset)
        .execute();

      // Map joined results to final output format
      return results.map((result: any) => ({
        id: result.final_outputs.id,
        video_id: result.final_outputs.video_id,
        translation_job_id: result.final_outputs.translation_job_id,
        audio_generation_job_id: result.final_outputs.audio_generation_job_id,
        final_video_path: result.final_outputs.final_video_path,
        created_at: result.final_outputs.created_at
      }));
    }

    // Handle simple query without joins
    const results = await db.select()
      .from(finalOutputsTable)
      .orderBy(desc(finalOutputsTable.created_at))
      .limit(limit)
      .offset(offset)
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch final outputs:', error);
    throw error;
  }
};