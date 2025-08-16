import { db } from '../db';
import { videosTable, translationJobsTable, audioGenerationJobsTable, finalOutputsTable } from '../db/schema';
import { type CreateFinalOutputInput, type FinalOutput } from '../schema';
import { eq, and } from 'drizzle-orm';

export const createFinalOutput = async (input: CreateFinalOutputInput): Promise<FinalOutput> => {
  try {
    // 1. Validate that the video exists and is uploaded
    const video = await db.select()
      .from(videosTable)
      .where(eq(videosTable.id, input.video_id))
      .execute();

    if (video.length === 0) {
      throw new Error(`Video with id ${input.video_id} not found`);
    }

    if (video[0].upload_status !== 'uploaded') {
      throw new Error(`Video with id ${input.video_id} is not uploaded (status: ${video[0].upload_status})`);
    }

    // 2. Validate that the translation job exists, belongs to the video, and is completed
    const translationJob = await db.select()
      .from(translationJobsTable)
      .where(
        and(
          eq(translationJobsTable.id, input.translation_job_id),
          eq(translationJobsTable.video_id, input.video_id)
        )
      )
      .execute();

    if (translationJob.length === 0) {
      throw new Error(`Translation job with id ${input.translation_job_id} not found for video ${input.video_id}`);
    }

    if (translationJob[0].status !== 'completed') {
      throw new Error(`Translation job with id ${input.translation_job_id} is not completed (status: ${translationJob[0].status})`);
    }

    // 3. Validate that the audio generation job exists, belongs to the translation job, and is completed
    const audioGenerationJob = await db.select()
      .from(audioGenerationJobsTable)
      .where(
        and(
          eq(audioGenerationJobsTable.id, input.audio_generation_job_id),
          eq(audioGenerationJobsTable.translation_job_id, input.translation_job_id)
        )
      )
      .execute();

    if (audioGenerationJob.length === 0) {
      throw new Error(`Audio generation job with id ${input.audio_generation_job_id} not found for translation job ${input.translation_job_id}`);
    }

    if (audioGenerationJob[0].status !== 'completed') {
      throw new Error(`Audio generation job with id ${input.audio_generation_job_id} is not completed (status: ${audioGenerationJob[0].status})`);
    }

    // 4. Check if a final output already exists for this combination
    const existingOutput = await db.select()
      .from(finalOutputsTable)
      .where(
        and(
          eq(finalOutputsTable.video_id, input.video_id),
          eq(finalOutputsTable.translation_job_id, input.translation_job_id),
          eq(finalOutputsTable.audio_generation_job_id, input.audio_generation_job_id)
        )
      )
      .execute();

    if (existingOutput.length > 0) {
      throw new Error(`Final output already exists for video ${input.video_id}, translation job ${input.translation_job_id}, and audio generation job ${input.audio_generation_job_id}`);
    }

    // 5. Create the final output record
    const result = await db.insert(finalOutputsTable)
      .values({
        video_id: input.video_id,
        translation_job_id: input.translation_job_id,
        audio_generation_job_id: input.audio_generation_job_id,
        final_video_path: input.final_video_path
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Final output creation failed:', error);
    throw error;
  }
};