import { db } from '../db';
import { videosTable, translationJobsTable } from '../db/schema';
import { type CreateTranslationJobInput, type TranslationJob } from '../schema';
import { eq } from 'drizzle-orm';

export const createTranslationJob = async (input: CreateTranslationJobInput): Promise<TranslationJob> => {
  try {
    // 1. Validate that the video exists and is uploaded
    const existingVideo = await db.select()
      .from(videosTable)
      .where(eq(videosTable.id, input.video_id))
      .execute();

    if (existingVideo.length === 0) {
      throw new Error(`Video with ID ${input.video_id} not found`);
    }

    const video = existingVideo[0];
    if (video.upload_status !== 'uploaded') {
      throw new Error(`Video must be uploaded before creating translation job. Current status: ${video.upload_status}`);
    }

    // 2. Create a new translation job record with 'pending' status
    const result = await db.insert(translationJobsTable)
      .values({
        video_id: input.video_id,
        source_language: input.source_language,
        target_language: input.target_language,
        status: 'pending'
        // Other fields (original_audio_path, translated_text, etc.) will default to null
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Translation job creation failed:', error);
    throw error;
  }
};