import { db } from '../db';
import { translationJobsTable } from '../db/schema';
import { type TranslationJob, type GetTranslationJobsQuery } from '../schema';
import { eq, and, desc, type SQL } from 'drizzle-orm';

export const getTranslationJobs = async (input?: GetTranslationJobsQuery): Promise<TranslationJob[]> => {
  try {
    // Parse input with defaults if undefined
    const params = input || { limit: 10, offset: 0 };
    
    // Build conditions array for filters
    const conditions: SQL<unknown>[] = [];

    if (params.video_id !== undefined) {
      conditions.push(eq(translationJobsTable.video_id, params.video_id));
    }

    if (params.status !== undefined) {
      conditions.push(eq(translationJobsTable.status, params.status));
    }

    // Build complete query in one chain to avoid type issues
    let baseQuery = db.select().from(translationJobsTable);

    // Build the final query with conditional where clause
    const finalQuery = conditions.length > 0
      ? baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : baseQuery;

    // Execute with ordering and pagination
    const results = await finalQuery
      .orderBy(desc(translationJobsTable.created_at))
      .limit(params.limit)
      .offset(params.offset)
      .execute();

    // Convert the results to match the schema types
    return results.map((job: any) => ({
      ...job,
      started_at: job.started_at,
      completed_at: job.completed_at,
      created_at: job.created_at
    }));
  } catch (error) {
    console.error('Translation jobs retrieval failed:', error);
    throw error;
  }
};