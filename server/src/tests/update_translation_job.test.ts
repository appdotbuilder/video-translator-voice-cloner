import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { videosTable, translationJobsTable } from '../db/schema';
import { type UpdateTranslationJobInput } from '../schema';
import { updateTranslationJob } from '../handlers/update_translation_job';
import { eq } from 'drizzle-orm';

// Test data for creating prerequisite records
const testVideoData = {
  filename: 'test-video.mp4',
  original_filename: 'original-test-video.mp4',
  file_path: '/uploads/test-video.mp4',
  file_size: 1048576,
  duration: 120,
  format: 'mp4'
};

const testTranslationJobData = {
  video_id: 1, // Will be set after video creation
  source_language: 'en' as const,
  target_language: 'es' as const
};

describe('updateTranslationJob', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let videoId: number;
  let translationJobId: number;

  beforeEach(async () => {
    // Create prerequisite video record
    const videoResult = await db.insert(videosTable)
      .values(testVideoData)
      .returning()
      .execute();
    videoId = videoResult[0].id;

    // Create translation job to update
    const jobResult = await db.insert(translationJobsTable)
      .values({
        ...testTranslationJobData,
        video_id: videoId
      })
      .returning()
      .execute();
    translationJobId = jobResult[0].id;
  });

  it('should update translation job status', async () => {
    const updateInput: UpdateTranslationJobInput = {
      id: translationJobId,
      status: 'extracting_audio'
    };

    const result = await updateTranslationJob(updateInput);

    expect(result.id).toEqual(translationJobId);
    expect(result.status).toEqual('extracting_audio');
    expect(result.video_id).toEqual(videoId);
    expect(result.source_language).toEqual('en');
    expect(result.target_language).toEqual('es');
  });

  it('should update multiple fields at once', async () => {
    const startedAt = new Date();
    const updateInput: UpdateTranslationJobInput = {
      id: translationJobId,
      status: 'translating',
      original_audio_path: '/audio/extracted-audio.wav',
      started_at: startedAt
    };

    const result = await updateTranslationJob(updateInput);

    expect(result.status).toEqual('translating');
    expect(result.original_audio_path).toEqual('/audio/extracted-audio.wav');
    expect(result.started_at).toBeInstanceOf(Date);
    expect(result.started_at?.getTime()).toEqual(startedAt.getTime());
  });

  it('should complete a translation job with all fields', async () => {
    const completedAt = new Date();
    const updateInput: UpdateTranslationJobInput = {
      id: translationJobId,
      status: 'completed',
      translated_text: 'Hola mundo, este es un video traducido.',
      completed_at: completedAt
    };

    const result = await updateTranslationJob(updateInput);

    expect(result.status).toEqual('completed');
    expect(result.translated_text).toEqual('Hola mundo, este es un video traducido.');
    expect(result.completed_at).toBeInstanceOf(Date);
    expect(result.completed_at?.getTime()).toEqual(completedAt.getTime());
    expect(result.error_message).toBeNull();
  });

  it('should handle translation job failure with error message', async () => {
    const updateInput: UpdateTranslationJobInput = {
      id: translationJobId,
      status: 'failed',
      error_message: 'Audio extraction failed: unsupported format'
    };

    const result = await updateTranslationJob(updateInput);

    expect(result.status).toEqual('failed');
    expect(result.error_message).toEqual('Audio extraction failed: unsupported format');
    expect(result.translated_text).toBeNull();
    expect(result.completed_at).toBeNull();
  });

  it('should update with nullable fields set to null', async () => {
    // First set some values
    await updateTranslationJob({
      id: translationJobId,
      original_audio_path: '/some/path.wav',
      translated_text: 'Some text'
    });

    // Then clear them by setting to null
    const updateInput: UpdateTranslationJobInput = {
      id: translationJobId,
      original_audio_path: null,
      translated_text: null,
      error_message: null
    };

    const result = await updateTranslationJob(updateInput);

    expect(result.original_audio_path).toBeNull();
    expect(result.translated_text).toBeNull();
    expect(result.error_message).toBeNull();
  });

  it('should persist changes to database', async () => {
    const updateInput: UpdateTranslationJobInput = {
      id: translationJobId,
      status: 'completed',
      translated_text: 'Texto traducido persistente'
    };

    await updateTranslationJob(updateInput);

    // Query database directly to verify persistence
    const jobs = await db.select()
      .from(translationJobsTable)
      .where(eq(translationJobsTable.id, translationJobId))
      .execute();

    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toEqual('completed');
    expect(jobs[0].translated_text).toEqual('Texto traducido persistente');
  });

  it('should throw error for non-existent translation job', async () => {
    const updateInput: UpdateTranslationJobInput = {
      id: 99999,
      status: 'completed'
    };

    await expect(updateTranslationJob(updateInput)).rejects.toThrow(/translation job with id 99999 not found/i);
  });

  it('should preserve unchanged fields when updating', async () => {
    // First, populate the job with initial data
    const initialUpdate: UpdateTranslationJobInput = {
      id: translationJobId,
      status: 'extracting_audio',
      original_audio_path: '/initial/path.wav',
      started_at: new Date('2023-01-01T10:00:00Z')
    };

    await updateTranslationJob(initialUpdate);

    // Then update only one field
    const partialUpdate: UpdateTranslationJobInput = {
      id: translationJobId,
      status: 'translating'
    };

    const result = await updateTranslationJob(partialUpdate);

    // Status should be updated, other fields preserved
    expect(result.status).toEqual('translating');
    expect(result.original_audio_path).toEqual('/initial/path.wav');
    expect(result.started_at).toBeInstanceOf(Date);
    expect(result.started_at?.toISOString()).toEqual('2023-01-01T10:00:00.000Z');
  });

  it('should handle timestamp fields correctly', async () => {
    const startTime = new Date('2023-12-01T10:30:00Z');
    const endTime = new Date('2023-12-01T11:15:00Z');

    const updateInput: UpdateTranslationJobInput = {
      id: translationJobId,
      status: 'completed',
      started_at: startTime,
      completed_at: endTime
    };

    const result = await updateTranslationJob(updateInput);

    expect(result.started_at).toBeInstanceOf(Date);
    expect(result.completed_at).toBeInstanceOf(Date);
    expect(result.started_at?.toISOString()).toEqual('2023-12-01T10:30:00.000Z');
    expect(result.completed_at?.toISOString()).toEqual('2023-12-01T11:15:00.000Z');
  });
});