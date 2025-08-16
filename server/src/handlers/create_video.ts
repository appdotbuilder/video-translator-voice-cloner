import { db } from '../db';
import { videosTable } from '../db/schema';
import { type CreateVideoInput, type Video } from '../schema';

export const createVideo = async (input: CreateVideoInput): Promise<Video> => {
  try {
    // Insert video record with pending status
    const result = await db.insert(videosTable)
      .values({
        filename: input.filename,
        original_filename: input.original_filename,
        file_path: input.file_path,
        file_size: input.file_size,
        duration: input.duration, // Can be null until processing is complete
        format: input.format,
        upload_status: 'pending' // Default status for new uploads
      })
      .returning()
      .execute();

    // Return the created video record
    const video = result[0];
    return {
      ...video,
      // Ensure proper date types are returned
      uploaded_at: video.uploaded_at,
      created_at: video.created_at
    };
  } catch (error) {
    console.error('Video creation failed:', error);
    throw error;
  }
};