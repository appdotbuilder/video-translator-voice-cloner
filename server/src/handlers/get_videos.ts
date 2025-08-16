import { db } from '../db';
import { videosTable } from '../db/schema';
import { type Video, getVideosQuerySchema } from '../schema';
import { eq, desc, and, SQL } from 'drizzle-orm';

export const getVideos = async (input: any = {}): Promise<Video[]> => {
  try {
    // Parse input with Zod to apply defaults
    const query = getVideosQuerySchema.parse(input);

    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    // Apply status filter if provided
    if (query.status) {
      conditions.push(eq(videosTable.upload_status, query.status));
    }

    // Build and execute the query in one chain
    const baseQuery = db.select().from(videosTable);
    
    const results = await (conditions.length > 0
      ? baseQuery
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(desc(videosTable.created_at))
          .limit(query.limit)
          .offset(query.offset)
      : baseQuery
          .orderBy(desc(videosTable.created_at))
          .limit(query.limit)
          .offset(query.offset)
    ).execute();

    // Return the results (no numeric conversion needed as all fields are already proper types)
    return results;
  } catch (error) {
    console.error('Get videos failed:', error);
    throw error;
  }
};