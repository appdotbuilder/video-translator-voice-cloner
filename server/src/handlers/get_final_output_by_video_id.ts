import { db } from '../db';
import { finalOutputsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type FinalOutput } from '../schema';

export async function getFinalOutputByVideoId(videoId: number): Promise<FinalOutput | null> {
  try {
    const results = await db.select()
      .from(finalOutputsTable)
      .where(eq(finalOutputsTable.video_id, videoId))
      .execute();

    if (results.length === 0) {
      return null;
    }

    // Return the first result (there should only be one final output per video)
    return results[0];
  } catch (error) {
    console.error('Failed to get final output by video ID:', error);
    throw error;
  }
}