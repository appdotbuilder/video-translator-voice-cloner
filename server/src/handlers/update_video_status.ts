import { db } from '../db';
import { videosTable } from '../db/schema';
import { type UpdateVideoStatusInput, type Video } from '../schema';
import { eq } from 'drizzle-orm';

export const updateVideoStatus = async (input: UpdateVideoStatusInput): Promise<Video> => {
  try {
    // Build the update object with only the fields that are provided
    const updateData: any = {
      upload_status: input.upload_status
    };

    // Add optional fields if they are provided
    if (input.duration !== undefined) {
      updateData.duration = input.duration;
    }

    if (input.format !== undefined) {
      updateData.format = input.format;
    }

    // Update the video record and return the updated data
    const result = await db.update(videosTable)
      .set(updateData)
      .where(eq(videosTable.id, input.id))
      .returning()
      .execute();

    // Check if video was found and updated
    if (result.length === 0) {
      throw new Error(`Video with ID ${input.id} not found`);
    }

    // Return the updated video record
    const video = result[0];
    return {
      ...video,
      duration: video.duration // No conversion needed since duration is stored as integer
    };
  } catch (error) {
    console.error('Video status update failed:', error);
    throw error;
  }
};