import { db } from '../db';
import { audioGenerationJobsTable } from '../db/schema';
import { type UpdateAudioGenerationJobInput, type AudioGenerationJob } from '../schema';
import { eq } from 'drizzle-orm';

export async function updateAudioGenerationJob(input: UpdateAudioGenerationJobInput): Promise<AudioGenerationJob> {
  try {
    // Build update object with only provided fields
    const updateData: Partial<typeof audioGenerationJobsTable.$inferInsert> = {};

    if (input.status !== undefined) {
      updateData.status = input.status;
    }
    if (input.generated_audio_path !== undefined) {
      updateData.generated_audio_path = input.generated_audio_path;
    }
    if (input.error_message !== undefined) {
      updateData.error_message = input.error_message;
    }
    if (input.started_at !== undefined) {
      updateData.started_at = input.started_at;
    }
    if (input.completed_at !== undefined) {
      updateData.completed_at = input.completed_at;
    }

    // Update the audio generation job
    const result = await db
      .update(audioGenerationJobsTable)
      .set(updateData)
      .where(eq(audioGenerationJobsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Audio generation job with id ${input.id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('Audio generation job update failed:', error);
    throw error;
  }
}