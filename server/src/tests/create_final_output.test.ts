import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { videosTable, translationJobsTable, audioGenerationJobsTable, finalOutputsTable } from '../db/schema';
import { type CreateFinalOutputInput } from '../schema';
import { createFinalOutput } from '../handlers/create_final_output';
import { eq } from 'drizzle-orm';

describe('createFinalOutput', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create prerequisite data
  const createPrerequisiteData = async () => {
    // Create video
    const video = await db.insert(videosTable)
      .values({
        filename: 'test_video.mp4',
        original_filename: 'original_video.mp4',
        file_path: '/uploads/test_video.mp4',
        file_size: 1024000,
        duration: 120,
        format: 'mp4',
        upload_status: 'uploaded'
      })
      .returning()
      .execute();

    // Create translation job
    const translationJob = await db.insert(translationJobsTable)
      .values({
        video_id: video[0].id,
        source_language: 'en',
        target_language: 'es',
        status: 'completed',
        original_audio_path: '/audio/original.wav',
        translated_text: 'Texto traducido',
        started_at: new Date('2024-01-01T10:00:00Z'),
        completed_at: new Date('2024-01-01T10:30:00Z')
      })
      .returning()
      .execute();

    // Create audio generation job
    const audioGenerationJob = await db.insert(audioGenerationJobsTable)
      .values({
        translation_job_id: translationJob[0].id,
        status: 'completed',
        generated_audio_path: '/audio/generated.wav',
        voice_cloned: true,
        started_at: new Date('2024-01-01T11:00:00Z'),
        completed_at: new Date('2024-01-01T11:15:00Z')
      })
      .returning()
      .execute();

    return {
      video: video[0],
      translationJob: translationJob[0],
      audioGenerationJob: audioGenerationJob[0]
    };
  };

  const testInput: CreateFinalOutputInput = {
    video_id: 1,
    translation_job_id: 1,
    audio_generation_job_id: 1,
    final_video_path: '/outputs/final_translated_video.mp4'
  };

  it('should create a final output successfully', async () => {
    const { video, translationJob, audioGenerationJob } = await createPrerequisiteData();

    const input: CreateFinalOutputInput = {
      video_id: video.id,
      translation_job_id: translationJob.id,
      audio_generation_job_id: audioGenerationJob.id,
      final_video_path: '/outputs/final_translated_video.mp4'
    };

    const result = await createFinalOutput(input);

    // Validate returned data
    expect(result.id).toBeDefined();
    expect(result.video_id).toEqual(video.id);
    expect(result.translation_job_id).toEqual(translationJob.id);
    expect(result.audio_generation_job_id).toEqual(audioGenerationJob.id);
    expect(result.final_video_path).toEqual('/outputs/final_translated_video.mp4');
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save final output to database', async () => {
    const { video, translationJob, audioGenerationJob } = await createPrerequisiteData();

    const input: CreateFinalOutputInput = {
      video_id: video.id,
      translation_job_id: translationJob.id,
      audio_generation_job_id: audioGenerationJob.id,
      final_video_path: '/outputs/final_translated_video.mp4'
    };

    const result = await createFinalOutput(input);

    // Query database to verify record was created
    const finalOutputs = await db.select()
      .from(finalOutputsTable)
      .where(eq(finalOutputsTable.id, result.id))
      .execute();

    expect(finalOutputs).toHaveLength(1);
    expect(finalOutputs[0].video_id).toEqual(video.id);
    expect(finalOutputs[0].translation_job_id).toEqual(translationJob.id);
    expect(finalOutputs[0].audio_generation_job_id).toEqual(audioGenerationJob.id);
    expect(finalOutputs[0].final_video_path).toEqual('/outputs/final_translated_video.mp4');
    expect(finalOutputs[0].created_at).toBeInstanceOf(Date);
  });

  it('should throw error if video does not exist', async () => {
    const input: CreateFinalOutputInput = {
      video_id: 999,
      translation_job_id: 1,
      audio_generation_job_id: 1,
      final_video_path: '/outputs/final_video.mp4'
    };

    await expect(createFinalOutput(input))
      .rejects
      .toThrow(/video with id 999 not found/i);
  });

  it('should throw error if video is not uploaded', async () => {
    // Create video with pending status
    const video = await db.insert(videosTable)
      .values({
        filename: 'test_video.mp4',
        original_filename: 'original_video.mp4',
        file_path: '/uploads/test_video.mp4',
        file_size: 1024000,
        duration: 120,
        format: 'mp4',
        upload_status: 'pending'
      })
      .returning()
      .execute();

    const input: CreateFinalOutputInput = {
      video_id: video[0].id,
      translation_job_id: 1,
      audio_generation_job_id: 1,
      final_video_path: '/outputs/final_video.mp4'
    };

    await expect(createFinalOutput(input))
      .rejects
      .toThrow(/video with id \d+ is not uploaded.*status: pending/i);
  });

  it('should throw error if translation job does not exist', async () => {
    // Create only video
    const video = await db.insert(videosTable)
      .values({
        filename: 'test_video.mp4',
        original_filename: 'original_video.mp4',
        file_path: '/uploads/test_video.mp4',
        file_size: 1024000,
        duration: 120,
        format: 'mp4',
        upload_status: 'uploaded'
      })
      .returning()
      .execute();

    const input: CreateFinalOutputInput = {
      video_id: video[0].id,
      translation_job_id: 999,
      audio_generation_job_id: 1,
      final_video_path: '/outputs/final_video.mp4'
    };

    await expect(createFinalOutput(input))
      .rejects
      .toThrow(/translation job with id 999 not found for video \d+/i);
  });

  it('should throw error if translation job does not belong to the video', async () => {
    // Create two videos
    const video1 = await db.insert(videosTable)
      .values({
        filename: 'test_video1.mp4',
        original_filename: 'original_video1.mp4',
        file_path: '/uploads/test_video1.mp4',
        file_size: 1024000,
        duration: 120,
        format: 'mp4',
        upload_status: 'uploaded'
      })
      .returning()
      .execute();

    const video2 = await db.insert(videosTable)
      .values({
        filename: 'test_video2.mp4',
        original_filename: 'original_video2.mp4',
        file_path: '/uploads/test_video2.mp4',
        file_size: 1024000,
        duration: 120,
        format: 'mp4',
        upload_status: 'uploaded'
      })
      .returning()
      .execute();

    // Create translation job for video2
    const translationJob = await db.insert(translationJobsTable)
      .values({
        video_id: video2[0].id,
        source_language: 'en',
        target_language: 'es',
        status: 'completed'
      })
      .returning()
      .execute();

    // Try to create final output for video1 with translation job from video2
    const input: CreateFinalOutputInput = {
      video_id: video1[0].id,
      translation_job_id: translationJob[0].id,
      audio_generation_job_id: 1,
      final_video_path: '/outputs/final_video.mp4'
    };

    await expect(createFinalOutput(input))
      .rejects
      .toThrow(/translation job with id \d+ not found for video \d+/i);
  });

  it('should throw error if translation job is not completed', async () => {
    const video = await db.insert(videosTable)
      .values({
        filename: 'test_video.mp4',
        original_filename: 'original_video.mp4',
        file_path: '/uploads/test_video.mp4',
        file_size: 1024000,
        duration: 120,
        format: 'mp4',
        upload_status: 'uploaded'
      })
      .returning()
      .execute();

    const translationJob = await db.insert(translationJobsTable)
      .values({
        video_id: video[0].id,
        source_language: 'en',
        target_language: 'es',
        status: 'translating'
      })
      .returning()
      .execute();

    const input: CreateFinalOutputInput = {
      video_id: video[0].id,
      translation_job_id: translationJob[0].id,
      audio_generation_job_id: 1,
      final_video_path: '/outputs/final_video.mp4'
    };

    await expect(createFinalOutput(input))
      .rejects
      .toThrow(/translation job with id \d+ is not completed.*status: translating/i);
  });

  it('should throw error if audio generation job does not exist', async () => {
    const video = await db.insert(videosTable)
      .values({
        filename: 'test_video.mp4',
        original_filename: 'original_video.mp4',
        file_path: '/uploads/test_video.mp4',
        file_size: 1024000,
        duration: 120,
        format: 'mp4',
        upload_status: 'uploaded'
      })
      .returning()
      .execute();

    const translationJob = await db.insert(translationJobsTable)
      .values({
        video_id: video[0].id,
        source_language: 'en',
        target_language: 'es',
        status: 'completed'
      })
      .returning()
      .execute();

    const input: CreateFinalOutputInput = {
      video_id: video[0].id,
      translation_job_id: translationJob[0].id,
      audio_generation_job_id: 999,
      final_video_path: '/outputs/final_video.mp4'
    };

    await expect(createFinalOutput(input))
      .rejects
      .toThrow(/audio generation job with id 999 not found for translation job \d+/i);
  });

  it('should throw error if audio generation job does not belong to the translation job', async () => {
    const video = await db.insert(videosTable)
      .values({
        filename: 'test_video.mp4',
        original_filename: 'original_video.mp4',
        file_path: '/uploads/test_video.mp4',
        file_size: 1024000,
        duration: 120,
        format: 'mp4',
        upload_status: 'uploaded'
      })
      .returning()
      .execute();

    // Create two translation jobs
    const translationJob1 = await db.insert(translationJobsTable)
      .values({
        video_id: video[0].id,
        source_language: 'en',
        target_language: 'es',
        status: 'completed'
      })
      .returning()
      .execute();

    const translationJob2 = await db.insert(translationJobsTable)
      .values({
        video_id: video[0].id,
        source_language: 'en',
        target_language: 'fr',
        status: 'completed'
      })
      .returning()
      .execute();

    // Create audio generation job for translationJob2
    const audioGenerationJob = await db.insert(audioGenerationJobsTable)
      .values({
        translation_job_id: translationJob2[0].id,
        status: 'completed'
      })
      .returning()
      .execute();

    // Try to create final output for translationJob1 with audio generation job from translationJob2
    const input: CreateFinalOutputInput = {
      video_id: video[0].id,
      translation_job_id: translationJob1[0].id,
      audio_generation_job_id: audioGenerationJob[0].id,
      final_video_path: '/outputs/final_video.mp4'
    };

    await expect(createFinalOutput(input))
      .rejects
      .toThrow(/audio generation job with id \d+ not found for translation job \d+/i);
  });

  it('should throw error if audio generation job is not completed', async () => {
    const video = await db.insert(videosTable)
      .values({
        filename: 'test_video.mp4',
        original_filename: 'original_video.mp4',
        file_path: '/uploads/test_video.mp4',
        file_size: 1024000,
        duration: 120,
        format: 'mp4',
        upload_status: 'uploaded'
      })
      .returning()
      .execute();

    const translationJob = await db.insert(translationJobsTable)
      .values({
        video_id: video[0].id,
        source_language: 'en',
        target_language: 'es',
        status: 'completed'
      })
      .returning()
      .execute();

    const audioGenerationJob = await db.insert(audioGenerationJobsTable)
      .values({
        translation_job_id: translationJob[0].id,
        status: 'generating'
      })
      .returning()
      .execute();

    const input: CreateFinalOutputInput = {
      video_id: video[0].id,
      translation_job_id: translationJob[0].id,
      audio_generation_job_id: audioGenerationJob[0].id,
      final_video_path: '/outputs/final_video.mp4'
    };

    await expect(createFinalOutput(input))
      .rejects
      .toThrow(/audio generation job with id \d+ is not completed.*status: generating/i);
  });

  it('should throw error if final output already exists for the same combination', async () => {
    const { video, translationJob, audioGenerationJob } = await createPrerequisiteData();

    const input: CreateFinalOutputInput = {
      video_id: video.id,
      translation_job_id: translationJob.id,
      audio_generation_job_id: audioGenerationJob.id,
      final_video_path: '/outputs/final_video.mp4'
    };

    // Create the first final output
    await createFinalOutput(input);

    // Try to create the same final output again
    const duplicateInput: CreateFinalOutputInput = {
      ...input,
      final_video_path: '/outputs/duplicate_video.mp4'
    };

    await expect(createFinalOutput(duplicateInput))
      .rejects
      .toThrow(/final output already exists for video \d+, translation job \d+, and audio generation job \d+/i);
  });

  it('should allow creating final outputs for different video/job combinations', async () => {
    const { video, translationJob, audioGenerationJob } = await createPrerequisiteData();

    // Create first final output
    const input1: CreateFinalOutputInput = {
      video_id: video.id,
      translation_job_id: translationJob.id,
      audio_generation_job_id: audioGenerationJob.id,
      final_video_path: '/outputs/final_video1.mp4'
    };

    const result1 = await createFinalOutput(input1);

    // Create second translation job and audio generation job for the same video
    const translationJob2 = await db.insert(translationJobsTable)
      .values({
        video_id: video.id,
        source_language: 'en',
        target_language: 'fr',
        status: 'completed'
      })
      .returning()
      .execute();

    const audioGenerationJob2 = await db.insert(audioGenerationJobsTable)
      .values({
        translation_job_id: translationJob2[0].id,
        status: 'completed'
      })
      .returning()
      .execute();

    // Create second final output with different jobs
    const input2: CreateFinalOutputInput = {
      video_id: video.id,
      translation_job_id: translationJob2[0].id,
      audio_generation_job_id: audioGenerationJob2[0].id,
      final_video_path: '/outputs/final_video2.mp4'
    };

    const result2 = await createFinalOutput(input2);

    // Both should succeed and have different IDs
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.translation_job_id).not.toEqual(result2.translation_job_id);
    expect(result1.audio_generation_job_id).not.toEqual(result2.audio_generation_job_id);
  });
});