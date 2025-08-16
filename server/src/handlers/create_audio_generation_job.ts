import { db } from '../db';
import { audioGenerationJobsTable, translationJobsTable } from '../db/schema';
import { type CreateAudioGenerationJobInput, type AudioGenerationJob } from '../schema';
import { eq } from 'drizzle-orm';

export const createAudioGenerationJob = async (input: CreateAudioGenerationJobInput): Promise<AudioGenerationJob> => {
  try {
    // Validate that the translation job exists and is completed
    const translationJob = await db.select()
      .from(translationJobsTable)
      .where(eq(translationJobsTable.id, input.translation_job_id))
      .execute();

    if (translationJob.length === 0) {
      throw new Error(`Translation job with ID ${input.translation_job_id} not found`);
    }

    if (translationJob[0].status !== 'completed') {
      throw new Error(`Translation job must be completed before audio generation. Current status: ${translationJob[0].status}`);
    }

    // Create a new audio generation job record
    const result = await db.insert(audioGenerationJobsTable)
      .values({
        translation_job_id: input.translation_job_id,
        voice_cloned: input.voice_cloned,
        status: 'pending'
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Audio generation job creation failed:', error);
    throw error;
  }
};