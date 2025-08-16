import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { videosTable, translationJobsTable } from '../db/schema';
import { type GetTranslationJobsQuery, type CreateVideoInput, type CreateTranslationJobInput } from '../schema';
import { getTranslationJobs } from '../handlers/get_translation_jobs';
import { eq } from 'drizzle-orm';

// Test data
const testVideoInput: CreateVideoInput = {
  filename: 'test_video.mp4',
  original_filename: 'original_test.mp4',
  file_path: '/uploads/test_video.mp4',
  file_size: 50000000,
  duration: 120,
  format: 'mp4'
};

const testTranslationJobInput1: CreateTranslationJobInput = {
  video_id: 1,
  source_language: 'en',
  target_language: 'es'
};

const testTranslationJobInput2: CreateTranslationJobInput = {
  video_id: 1,
  source_language: 'en',
  target_language: 'fr'
};

const testTranslationJobInput3: CreateTranslationJobInput = {
  video_id: 2,
  source_language: 'es',
  target_language: 'en'
};

describe('getTranslationJobs', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch all translation jobs with default pagination', async () => {
    // Create test video first
    const videoResult = await db.insert(videosTable)
      .values(testVideoInput)
      .returning()
      .execute();
    const video = videoResult[0];

    // Create translation jobs
    const jobInput1 = { ...testTranslationJobInput1, video_id: video.id };
    const jobInput2 = { ...testTranslationJobInput2, video_id: video.id };

    await db.insert(translationJobsTable)
      .values([jobInput1, jobInput2])
      .execute();

    const query: GetTranslationJobsQuery = {
      limit: 10,
      offset: 0
    };

    const result = await getTranslationJobs(query);

    expect(result).toHaveLength(2);
    expect(result[0].video_id).toEqual(video.id);
    expect(result[0].source_language).toEqual('en');
    expect(result[0].status).toEqual('pending'); // Default status
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].id).toBeDefined();
  });

  it('should filter by video_id', async () => {
    // Create two test videos
    const video1Result = await db.insert(videosTable)
      .values(testVideoInput)
      .returning()
      .execute();
    const video1 = video1Result[0];

    const video2Input = {
      ...testVideoInput,
      filename: 'test_video2.mp4',
      file_path: '/uploads/test_video2.mp4'
    };
    const video2Result = await db.insert(videosTable)
      .values(video2Input)
      .returning()
      .execute();
    const video2 = video2Result[0];

    // Create translation jobs for both videos
    const job1Input = { ...testTranslationJobInput1, video_id: video1.id };
    const job2Input = { ...testTranslationJobInput2, video_id: video1.id };
    const job3Input = { ...testTranslationJobInput3, video_id: video2.id };

    await db.insert(translationJobsTable)
      .values([job1Input, job2Input, job3Input])
      .execute();

    const query: GetTranslationJobsQuery = {
      video_id: video1.id,
      limit: 10,
      offset: 0
    };

    const result = await getTranslationJobs(query);

    expect(result).toHaveLength(2);
    result.forEach(job => {
      expect(job.video_id).toEqual(video1.id);
    });
  });

  it('should filter by status', async () => {
    // Create test video
    const videoResult = await db.insert(videosTable)
      .values(testVideoInput)
      .returning()
      .execute();
    const video = videoResult[0];

    // Create translation jobs with different statuses
    const pendingJobResult = await db.insert(translationJobsTable)
      .values({ ...testTranslationJobInput1, video_id: video.id })
      .returning()
      .execute();

    const completedJobResult = await db.insert(translationJobsTable)
      .values({ 
        ...testTranslationJobInput2, 
        video_id: video.id,
        status: 'completed'
      })
      .returning()
      .execute();

    // Update one job to completed status for testing
    await db.update(translationJobsTable)
      .set({ 
        status: 'completed',
        completed_at: new Date()
      })
      .where(eq(translationJobsTable.id, completedJobResult[0].id))
      .execute();

    const query: GetTranslationJobsQuery = {
      status: 'completed',
      limit: 10,
      offset: 0
    };

    const result = await getTranslationJobs(query);

    expect(result).toHaveLength(1);
    expect(result[0].status).toEqual('completed');
    expect(result[0].completed_at).toBeInstanceOf(Date);
  });

  it('should apply pagination correctly', async () => {
    // Create test video
    const videoResult = await db.insert(videosTable)
      .values(testVideoInput)
      .returning()
      .execute();
    const video = videoResult[0];

    // Create multiple translation jobs
    const jobs = [
      { ...testTranslationJobInput1, video_id: video.id },
      { ...testTranslationJobInput2, video_id: video.id },
      { video_id: video.id, source_language: 'en' as const, target_language: 'de' as const }
    ];

    await db.insert(translationJobsTable)
      .values(jobs)
      .execute();

    // Test first page
    const page1Query: GetTranslationJobsQuery = {
      limit: 2,
      offset: 0
    };

    const page1Result = await getTranslationJobs(page1Query);
    expect(page1Result).toHaveLength(2);

    // Test second page
    const page2Query: GetTranslationJobsQuery = {
      limit: 2,
      offset: 2
    };

    const page2Result = await getTranslationJobs(page2Query);
    expect(page2Result).toHaveLength(1);

    // Ensure no overlap between pages
    const page1Ids = page1Result.map(job => job.id);
    const page2Ids = page2Result.map(job => job.id);
    const intersection = page1Ids.filter(id => page2Ids.includes(id));
    expect(intersection).toHaveLength(0);
  });

  it('should combine multiple filters', async () => {
    // Create two test videos
    const video1Result = await db.insert(videosTable)
      .values(testVideoInput)
      .returning()
      .execute();
    const video1 = video1Result[0];

    const video2Input = {
      ...testVideoInput,
      filename: 'test_video2.mp4',
      file_path: '/uploads/test_video2.mp4'
    };
    const video2Result = await db.insert(videosTable)
      .values(video2Input)
      .returning()
      .execute();
    const video2 = video2Result[0];

    // Create jobs with different combinations
    const jobs = [
      { ...testTranslationJobInput1, video_id: video1.id }, // pending, video1
      { ...testTranslationJobInput2, video_id: video1.id }, // pending, video1 
      { ...testTranslationJobInput3, video_id: video2.id }, // pending, video2
    ];

    const insertedJobs = await db.insert(translationJobsTable)
      .values(jobs)
      .returning()
      .execute();

    // Update one job to completed status
    await db.update(translationJobsTable)
      .set({ 
        status: 'completed',
        completed_at: new Date()
      })
      .where(eq(translationJobsTable.id, insertedJobs[1].id))
      .execute();

    const query: GetTranslationJobsQuery = {
      video_id: video1.id,
      status: 'pending',
      limit: 10,
      offset: 0
    };

    const result = await getTranslationJobs(query);

    expect(result).toHaveLength(1);
    expect(result[0].video_id).toEqual(video1.id);
    expect(result[0].status).toEqual('pending');
  });

  it('should return empty array when no jobs match filters', async () => {
    // Create test video
    const videoResult = await db.insert(videosTable)
      .values(testVideoInput)
      .returning()
      .execute();
    const video = videoResult[0];

    // Create a job with pending status
    await db.insert(translationJobsTable)
      .values({ ...testTranslationJobInput1, video_id: video.id })
      .execute();

    const query: GetTranslationJobsQuery = {
      status: 'completed', // No jobs have this status
      limit: 10,
      offset: 0
    };

    const result = await getTranslationJobs(query);

    expect(result).toHaveLength(0);
  });

  it('should order results by created_at descending', async () => {
    // Create test video
    const videoResult = await db.insert(videosTable)
      .values(testVideoInput)
      .returning()
      .execute();
    const video = videoResult[0];

    // Create jobs at different times (simulate by inserting separately)
    const job1Result = await db.insert(translationJobsTable)
      .values({ ...testTranslationJobInput1, video_id: video.id })
      .returning()
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const job2Result = await db.insert(translationJobsTable)
      .values({ ...testTranslationJobInput2, video_id: video.id })
      .returning()
      .execute();

    const query: GetTranslationJobsQuery = {
      limit: 10,
      offset: 0
    };

    const result = await getTranslationJobs(query);

    expect(result).toHaveLength(2);
    // Newest first (job2 should come before job1)
    expect(result[0].created_at.getTime()).toBeGreaterThanOrEqual(
      result[1].created_at.getTime()
    );
  });
});