import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { videosTable, translationJobsTable, audioGenerationJobsTable } from '../db/schema';
import { type UpdateAudioGenerationJobInput } from '../schema';
import { updateAudioGenerationJob } from '../handlers/update_audio_generation_job';
import { eq } from 'drizzle-orm';

describe('updateAudioGenerationJob', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test data
  const createTestData = async () => {
    // Create a video
    const videoResult = await db.insert(videosTable)
      .values({
        filename: 'test-video.mp4',
        original_filename: 'original-test.mp4',
        file_path: '/uploads/test-video.mp4',
        file_size: 1000000,
        duration: 120,
        format: 'mp4',
        upload_status: 'uploaded'
      })
      .returning()
      .execute();

    // Create a translation job
    const translationJobResult = await db.insert(translationJobsTable)
      .values({
        video_id: videoResult[0].id,
        source_language: 'en',
        target_language: 'es',
        status: 'completed',
        translated_text: 'Texto traducido'
      })
      .returning()
      .execute();

    // Create an audio generation job
    const audioJobResult = await db.insert(audioGenerationJobsTable)
      .values({
        translation_job_id: translationJobResult[0].id,
        status: 'pending',
        voice_cloned: true
      })
      .returning()
      .execute();

    return {
      video: videoResult[0],
      translationJob: translationJobResult[0],
      audioJob: audioJobResult[0]
    };
  };

  it('should update audio generation job status', async () => {
    const { audioJob } = await createTestData();

    const updateInput: UpdateAudioGenerationJobInput = {
      id: audioJob.id,
      status: 'generating'
    };

    const result = await updateAudioGenerationJob(updateInput);

    expect(result.id).toEqual(audioJob.id);
    expect(result.status).toEqual('generating');
    expect(result.translation_job_id).toEqual(audioJob.translation_job_id);
    expect(result.voice_cloned).toEqual(true);
  });

  it('should update generated audio path when job completes', async () => {
    const { audioJob } = await createTestData();

    const updateInput: UpdateAudioGenerationJobInput = {
      id: audioJob.id,
      status: 'completed',
      generated_audio_path: '/audio/generated-123.wav',
      completed_at: new Date()
    };

    const result = await updateAudioGenerationJob(updateInput);

    expect(result.status).toEqual('completed');
    expect(result.generated_audio_path).toEqual('/audio/generated-123.wav');
    expect(result.completed_at).toBeInstanceOf(Date);
  });

  it('should update error information when job fails', async () => {
    const { audioJob } = await createTestData();

    const updateInput: UpdateAudioGenerationJobInput = {
      id: audioJob.id,
      status: 'failed',
      error_message: 'Voice cloning failed: insufficient audio data',
      completed_at: new Date()
    };

    const result = await updateAudioGenerationJob(updateInput);

    expect(result.status).toEqual('failed');
    expect(result.error_message).toEqual('Voice cloning failed: insufficient audio data');
    expect(result.completed_at).toBeInstanceOf(Date);
    expect(result.generated_audio_path).toBeNull();
  });

  it('should update start timestamp when job begins', async () => {
    const { audioJob } = await createTestData();

    const startTime = new Date();
    const updateInput: UpdateAudioGenerationJobInput = {
      id: audioJob.id,
      status: 'generating',
      started_at: startTime
    };

    const result = await updateAudioGenerationJob(updateInput);

    expect(result.status).toEqual('generating');
    expect(result.started_at).toBeInstanceOf(Date);
    expect(result.started_at?.getTime()).toEqual(startTime.getTime());
  });

  it('should update multiple fields simultaneously', async () => {
    const { audioJob } = await createTestData();

    const startTime = new Date();
    const completionTime = new Date(startTime.getTime() + 60000); // 1 minute later

    const updateInput: UpdateAudioGenerationJobInput = {
      id: audioJob.id,
      status: 'completed',
      generated_audio_path: '/audio/final-output.wav',
      started_at: startTime,
      completed_at: completionTime
    };

    const result = await updateAudioGenerationJob(updateInput);

    expect(result.status).toEqual('completed');
    expect(result.generated_audio_path).toEqual('/audio/final-output.wav');
    expect(result.started_at?.getTime()).toEqual(startTime.getTime());
    expect(result.completed_at?.getTime()).toEqual(completionTime.getTime());
    expect(result.error_message).toBeNull();
  });

  it('should persist changes to database', async () => {
    const { audioJob } = await createTestData();

    const updateInput: UpdateAudioGenerationJobInput = {
      id: audioJob.id,
      status: 'completed',
      generated_audio_path: '/audio/test-output.wav'
    };

    await updateAudioGenerationJob(updateInput);

    // Verify changes were persisted
    const jobs = await db.select()
      .from(audioGenerationJobsTable)
      .where(eq(audioGenerationJobsTable.id, audioJob.id))
      .execute();

    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toEqual('completed');
    expect(jobs[0].generated_audio_path).toEqual('/audio/test-output.wav');
  });

  it('should throw error for non-existent job', async () => {
    const updateInput: UpdateAudioGenerationJobInput = {
      id: 99999,
      status: 'completed'
    };

    await expect(updateAudioGenerationJob(updateInput))
      .rejects.toThrow(/Audio generation job with id 99999 not found/);
  });

  it('should handle null values correctly', async () => {
    const { audioJob } = await createTestData();

    // First set some values
    await updateAudioGenerationJob({
      id: audioJob.id,
      generated_audio_path: '/some/path.wav',
      error_message: 'Some error'
    });

    // Now set them to null
    const updateInput: UpdateAudioGenerationJobInput = {
      id: audioJob.id,
      generated_audio_path: null,
      error_message: null
    };

    const result = await updateAudioGenerationJob(updateInput);

    expect(result.generated_audio_path).toBeNull();
    expect(result.error_message).toBeNull();
  });

  it('should only update provided fields', async () => {
    const { audioJob } = await createTestData();

    // Get original job data
    const originalJobs = await db.select()
      .from(audioGenerationJobsTable)
      .where(eq(audioGenerationJobsTable.id, audioJob.id))
      .execute();
    const originalJob = originalJobs[0];

    // Update only status
    const updateInput: UpdateAudioGenerationJobInput = {
      id: audioJob.id,
      status: 'generating'
    };

    const result = await updateAudioGenerationJob(updateInput);

    // Status should be updated
    expect(result.status).toEqual('generating');
    // Other fields should remain unchanged
    expect(result.voice_cloned).toEqual(originalJob.voice_cloned);
    expect(result.translation_job_id).toEqual(originalJob.translation_job_id);
    expect(result.created_at.getTime()).toEqual(originalJob.created_at.getTime());
  });
});