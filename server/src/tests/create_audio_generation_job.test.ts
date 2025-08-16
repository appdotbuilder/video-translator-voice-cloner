import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { videosTable, translationJobsTable, audioGenerationJobsTable } from '../db/schema';
import { type CreateAudioGenerationJobInput } from '../schema';
import { createAudioGenerationJob } from '../handlers/create_audio_generation_job';
import { eq } from 'drizzle-orm';

describe('createAudioGenerationJob', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create prerequisite data
  const createPrerequisiteData = async () => {
    // Create a video record
    const videoResult = await db.insert(videosTable)
      .values({
        filename: 'test-video.mp4',
        original_filename: 'original-test-video.mp4',
        file_path: '/uploads/test-video.mp4',
        file_size: 1024000,
        duration: 120,
        format: 'mp4',
        upload_status: 'uploaded'
      })
      .returning()
      .execute();

    // Create a completed translation job
    const translationJobResult = await db.insert(translationJobsTable)
      .values({
        video_id: videoResult[0].id,
        source_language: 'en',
        target_language: 'es',
        status: 'completed',
        original_audio_path: '/audio/extracted.wav',
        translated_text: 'Hola mundo'
      })
      .returning()
      .execute();

    return {
      video: videoResult[0],
      translationJob: translationJobResult[0]
    };
  };

  const testInput: CreateAudioGenerationJobInput = {
    translation_job_id: 1,
    voice_cloned: true
  };

  it('should create an audio generation job when translation job is completed', async () => {
    const { translationJob } = await createPrerequisiteData();
    
    const input: CreateAudioGenerationJobInput = {
      translation_job_id: translationJob.id,
      voice_cloned: true
    };

    const result = await createAudioGenerationJob(input);

    // Verify basic fields
    expect(result.id).toBeDefined();
    expect(result.translation_job_id).toEqual(translationJob.id);
    expect(result.status).toEqual('pending');
    expect(result.voice_cloned).toEqual(true);
    expect(result.generated_audio_path).toBeNull();
    expect(result.error_message).toBeNull();
    expect(result.started_at).toBeNull();
    expect(result.completed_at).toBeNull();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save audio generation job to database', async () => {
    const { translationJob } = await createPrerequisiteData();
    
    const input: CreateAudioGenerationJobInput = {
      translation_job_id: translationJob.id,
      voice_cloned: false
    };

    const result = await createAudioGenerationJob(input);

    // Query database to verify the record was saved
    const savedJobs = await db.select()
      .from(audioGenerationJobsTable)
      .where(eq(audioGenerationJobsTable.id, result.id))
      .execute();

    expect(savedJobs).toHaveLength(1);
    expect(savedJobs[0].translation_job_id).toEqual(translationJob.id);
    expect(savedJobs[0].status).toEqual('pending');
    expect(savedJobs[0].voice_cloned).toEqual(false);
    expect(savedJobs[0].created_at).toBeInstanceOf(Date);
  });

  it('should use voice_cloned default value when not provided', async () => {
    const { translationJob } = await createPrerequisiteData();
    
    // Input without voice_cloned (should use Zod default of true)
    const input = {
      translation_job_id: translationJob.id
    } as CreateAudioGenerationJobInput;

    const result = await createAudioGenerationJob(input);

    expect(result.voice_cloned).toEqual(true);
  });

  it('should throw error when translation job does not exist', async () => {
    const input: CreateAudioGenerationJobInput = {
      translation_job_id: 999, // Non-existent ID
      voice_cloned: true
    };

    await expect(createAudioGenerationJob(input))
      .rejects.toThrow(/translation job with id 999 not found/i);
  });

  it('should throw error when translation job is not completed', async () => {
    const { video } = await createPrerequisiteData();

    // Create a pending translation job
    const pendingTranslationJob = await db.insert(translationJobsTable)
      .values({
        video_id: video.id,
        source_language: 'en',
        target_language: 'fr',
        status: 'pending'
      })
      .returning()
      .execute();

    const input: CreateAudioGenerationJobInput = {
      translation_job_id: pendingTranslationJob[0].id,
      voice_cloned: true
    };

    await expect(createAudioGenerationJob(input))
      .rejects.toThrow(/translation job must be completed.*current status: pending/i);
  });

  it('should throw error when translation job is in failed status', async () => {
    const { video } = await createPrerequisiteData();

    // Create a failed translation job
    const failedTranslationJob = await db.insert(translationJobsTable)
      .values({
        video_id: video.id,
        source_language: 'en',
        target_language: 'de',
        status: 'failed',
        error_message: 'Translation process failed'
      })
      .returning()
      .execute();

    const input: CreateAudioGenerationJobInput = {
      translation_job_id: failedTranslationJob[0].id,
      voice_cloned: true
    };

    await expect(createAudioGenerationJob(input))
      .rejects.toThrow(/translation job must be completed.*current status: failed/i);
  });

  it('should allow multiple audio generation jobs for same translation job', async () => {
    const { translationJob } = await createPrerequisiteData();
    
    const input1: CreateAudioGenerationJobInput = {
      translation_job_id: translationJob.id,
      voice_cloned: true
    };

    const input2: CreateAudioGenerationJobInput = {
      translation_job_id: translationJob.id,
      voice_cloned: false
    };

    const result1 = await createAudioGenerationJob(input1);
    const result2 = await createAudioGenerationJob(input2);

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.translation_job_id).toEqual(result2.translation_job_id);
    expect(result1.voice_cloned).toEqual(true);
    expect(result2.voice_cloned).toEqual(false);

    // Verify both records exist in database
    const allJobs = await db.select()
      .from(audioGenerationJobsTable)
      .where(eq(audioGenerationJobsTable.translation_job_id, translationJob.id))
      .execute();

    expect(allJobs).toHaveLength(2);
  });
});