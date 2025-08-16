import { db } from '../db';
import { translationJobsTable } from '../db/schema';
import { type UpdateTranslationJobInput, type TranslationJob } from '../schema';
import { eq } from 'drizzle-orm';

export async function updateTranslationJob(input: UpdateTranslationJobInput): Promise<TranslationJob> {
  try {
    // Build the update object with only the fields that were provided
    const updateData: Partial<typeof translationJobsTable.$inferInsert> = {};
    
    if (input.status !== undefined) {
      updateData.status = input.status;
    }
    
    if (input.original_audio_path !== undefined) {
      updateData.original_audio_path = input.original_audio_path;
    }
    
    if (input.translated_text !== undefined) {
      updateData.translated_text = input.translated_text;
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

    // Update the translation job record
    const result = await db.update(translationJobsTable)
      .set(updateData)
      .where(eq(translationJobsTable.id, input.id))
      .returning()
      .execute();

    // Check if job was found and updated
    if (result.length === 0) {
      throw new Error(`Translation job with id ${input.id} not found`);
    }

    // Return the updated translation job
    return result[0];
  } catch (error) {
    console.error('Translation job update failed:', error);
    throw error;
  }
}