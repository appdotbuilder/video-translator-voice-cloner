import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { videosTable, translationJobsTable } from '../db/schema';
import { type CreateTranslationJobInput } from '../schema';
import { createTranslationJob } from '../handlers/create_translation_job';
import { eq } from 'drizzle-orm';

describe('createTranslationJob', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create a test video
  const createTestVideo = async (uploadStatus: 'pending' | 'uploaded' | 'processing' | 'failed' = 'uploaded') => {
    const result = await db.insert(videosTable)
      .values({
        filename: 'test-video.mp4',
        original_filename: 'user-video.mp4',
        file_path: '/uploads/test-video.mp4',
        file_size: 1024000,
        duration: 120,
        format: 'mp4',
        upload_status: uploadStatus
      })
      .returning()
      .execute();

    return result[0];
  };

  const testInput: CreateTranslationJobInput = {
    video_id: 1, // Will be updated in tests with actual video ID
    source_language: 'en',
    target_language: 'es'
  };

  it('should create a translation job for an uploaded video', async () => {
    // Create prerequisite video
    const video = await createTestVideo('uploaded');
    const input = { ...testInput, video_id: video.id };

    const result = await createTranslationJob(input);

    // Basic field validation
    expect(result.id).toBeDefined();
    expect(result.video_id).toEqual(video.id);
    expect(result.source_language).toEqual('en');
    expect(result.target_language).toEqual('es');
    expect(result.status).toEqual('pending');
    expect(result.original_audio_path).toBeNull();
    expect(result.translated_text).toBeNull();
    expect(result.error_message).toBeNull();
    expect(result.started_at).toBeNull();
    expect(result.completed_at).toBeNull();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save translation job to database', async () => {
    // Create prerequisite video
    const video = await createTestVideo('uploaded');
    const input = { ...testInput, video_id: video.id };

    const result = await createTranslationJob(input);

    // Query database to verify the record was created
    const jobs = await db.select()
      .from(translationJobsTable)
      .where(eq(translationJobsTable.id, result.id))
      .execute();

    expect(jobs).toHaveLength(1);
    expect(jobs[0].video_id).toEqual(video.id);
    expect(jobs[0].source_language).toEqual('en');
    expect(jobs[0].target_language).toEqual('es');
    expect(jobs[0].status).toEqual('pending');
    expect(jobs[0].created_at).toBeInstanceOf(Date);
  });

  it('should throw error when video does not exist', async () => {
    const input = { ...testInput, video_id: 999 }; // Non-existent video ID

    await expect(createTranslationJob(input)).rejects.toThrow(/video with id 999 not found/i);
  });

  it('should throw error when video is not uploaded', async () => {
    // Create video with 'pending' status
    const video = await createTestVideo('pending');
    const input = { ...testInput, video_id: video.id };

    await expect(createTranslationJob(input)).rejects.toThrow(/video must be uploaded/i);
  });

  it('should throw error when video is in processing status', async () => {
    // Create video with 'processing' status
    const video = await createTestVideo('processing');
    const input = { ...testInput, video_id: video.id };

    await expect(createTranslationJob(input)).rejects.toThrow(/video must be uploaded/i);
  });

  it('should throw error when video upload failed', async () => {
    // Create video with 'failed' status
    const video = await createTestVideo('failed');
    const input = { ...testInput, video_id: video.id };

    await expect(createTranslationJob(input)).rejects.toThrow(/video must be uploaded/i);
  });

  it('should handle different language combinations', async () => {
    // Create prerequisite video
    const video = await createTestVideo('uploaded');

    // Test different language combinations
    const languagePairs = [
      { source: 'fr' as const, target: 'en' as const },
      { source: 'zh' as const, target: 'ja' as const },
      { source: 'es' as const, target: 'pt' as const }
    ];

    for (const pair of languagePairs) {
      const input: CreateTranslationJobInput = {
        video_id: video.id,
        source_language: pair.source,
        target_language: pair.target
      };

      const result = await createTranslationJob(input);

      expect(result.source_language).toEqual(pair.source);
      expect(result.target_language).toEqual(pair.target);
      expect(result.status).toEqual('pending');
    }
  });

  it('should create multiple translation jobs for the same video', async () => {
    // Create prerequisite video
    const video = await createTestVideo('uploaded');

    // Create first translation job
    const input1 = {
      video_id: video.id,
      source_language: 'en' as const,
      target_language: 'es' as const
    };
    const job1 = await createTranslationJob(input1);

    // Create second translation job for same video
    const input2 = {
      video_id: video.id,
      source_language: 'en' as const,
      target_language: 'fr' as const
    };
    const job2 = await createTranslationJob(input2);

    // Both jobs should exist and be different
    expect(job1.id).not.toEqual(job2.id);
    expect(job1.target_language).toEqual('es');
    expect(job2.target_language).toEqual('fr');

    // Verify both are saved in database
    const allJobs = await db.select()
      .from(translationJobsTable)
      .where(eq(translationJobsTable.video_id, video.id))
      .execute();

    expect(allJobs).toHaveLength(2);
  });
});