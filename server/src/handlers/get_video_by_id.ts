import { db } from '../db';
import { videosTable } from '../db/schema';
import { type Video } from '../schema';
import { eq } from 'drizzle-orm';

export async function getVideoById(id: number): Promise<Video | null> {
  try {
    // Query the database for the video with the given ID
    const result = await db.select()
      .from(videosTable)
      .where(eq(videosTable.id, id))
      .execute();

    // Return null if video not found
    if (result.length === 0) {
      return null;
    }

    const video = result[0];
    
    // Return the video record - no numeric conversions needed as all fields are already proper types
    return {
      ...video,
      // Ensure dates are properly typed
      uploaded_at: new Date(video.uploaded_at),
      created_at: new Date(video.created_at)
    };
  } catch (error) {
    console.error('Failed to get video by ID:', error);
    throw error;
  }
}