import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { videosTable, translationJobsTable, audioGenerationJobsTable, finalOutputsTable } from '../db/schema';
import { getFinalOutputByVideoId } from '../handlers/get_final_output_by_video_id';

describe('getFinalOutputByVideoId', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return final output when found by video ID', async () => {
    // Create prerequisite records
    const videoResult = await db.insert(videosTable)
      .values({
        filename: 'test_video.mp4',
        original_filename: 'original_test_video.mp4',
        file_path: '/uploads/test_video.mp4',
        file_size: 1024000,
        duration: 120,
        format: 'mp4',
        upload_status: 'uploaded'
      })
      .returning()
      .execute();

    const translationResult = await db.insert(translationJobsTable)
      .values({
        video_id: videoResult[0].id,
        source_language: 'en',
        target_language: 'es',
        status: 'completed',
        original_audio_path: '/audio/original.wav',
        translated_text: 'Texto traducido'
      })
      .returning()
      .execute();

    const audioResult = await db.insert(audioGenerationJobsTable)
      .values({
        translation_job_id: translationResult[0].id,
        status: 'completed',
        generated_audio_path: '/audio/generated.wav',
        voice_cloned: true
      })
      .returning()
      .execute();

    const finalOutputResult = await db.insert(finalOutputsTable)
      .values({
        video_id: videoResult[0].id,
        translation_job_id: translationResult[0].id,
        audio_generation_job_id: audioResult[0].id,
        final_video_path: '/outputs/final_video.mp4'
      })
      .returning()
      .execute();

    // Test the handler
    const result = await getFinalOutputByVideoId(videoResult[0].id);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(finalOutputResult[0].id);
    expect(result!.video_id).toBe(videoResult[0].id);
    expect(result!.translation_job_id).toBe(translationResult[0].id);
    expect(result!.audio_generation_job_id).toBe(audioResult[0].id);
    expect(result!.final_video_path).toBe('/outputs/final_video.mp4');
    expect(result!.created_at).toBeInstanceOf(Date);
  });

  it('should return null when no final output exists for video ID', async () => {
    // Create a video but no final output
    const videoResult = await db.insert(videosTable)
      .values({
        filename: 'test_video.mp4',
        original_filename: 'original_test_video.mp4',
        file_path: '/uploads/test_video.mp4',
        file_size: 1024000,
        duration: 120,
        format: 'mp4',
        upload_status: 'uploaded'
      })
      .returning()
      .execute();

    const result = await getFinalOutputByVideoId(videoResult[0].id);

    expect(result).toBeNull();
  });

  it('should return null when video ID does not exist', async () => {
    const result = await getFinalOutputByVideoId(999999);

    expect(result).toBeNull();
  });

  it('should return the correct final output when multiple videos exist', async () => {
    // Create first video and its final output
    const video1Result = await db.insert(videosTable)
      .values({
        filename: 'video1.mp4',
        original_filename: 'original_video1.mp4',
        file_path: '/uploads/video1.mp4',
        file_size: 1024000,
        duration: 120,
        format: 'mp4',
        upload_status: 'uploaded'
      })
      .returning()
      .execute();

    const translation1Result = await db.insert(translationJobsTable)
      .values({
        video_id: video1Result[0].id,
        source_language: 'en',
        target_language: 'es',
        status: 'completed'
      })
      .returning()
      .execute();

    const audio1Result = await db.insert(audioGenerationJobsTable)
      .values({
        translation_job_id: translation1Result[0].id,
        status: 'completed',
        voice_cloned: true
      })
      .returning()
      .execute();

    const finalOutput1Result = await db.insert(finalOutputsTable)
      .values({
        video_id: video1Result[0].id,
        translation_job_id: translation1Result[0].id,
        audio_generation_job_id: audio1Result[0].id,
        final_video_path: '/outputs/final_video1.mp4'
      })
      .returning()
      .execute();

    // Create second video and its final output
    const video2Result = await db.insert(videosTable)
      .values({
        filename: 'video2.mp4',
        original_filename: 'original_video2.mp4',
        file_path: '/uploads/video2.mp4',
        file_size: 2048000,
        duration: 240,
        format: 'mp4',
        upload_status: 'uploaded'
      })
      .returning()
      .execute();

    const translation2Result = await db.insert(translationJobsTable)
      .values({
        video_id: video2Result[0].id,
        source_language: 'fr',
        target_language: 'de',
        status: 'completed'
      })
      .returning()
      .execute();

    const audio2Result = await db.insert(audioGenerationJobsTable)
      .values({
        translation_job_id: translation2Result[0].id,
        status: 'completed',
        voice_cloned: false
      })
      .returning()
      .execute();

    const finalOutput2Result = await db.insert(finalOutputsTable)
      .values({
        video_id: video2Result[0].id,
        translation_job_id: translation2Result[0].id,
        audio_generation_job_id: audio2Result[0].id,
        final_video_path: '/outputs/final_video2.mp4'
      })
      .returning()
      .execute();

    // Test getting final output for video 1
    const result1 = await getFinalOutputByVideoId(video1Result[0].id);
    expect(result1).not.toBeNull();
    expect(result1!.id).toBe(finalOutput1Result[0].id);
    expect(result1!.final_video_path).toBe('/outputs/final_video1.mp4');

    // Test getting final output for video 2
    const result2 = await getFinalOutputByVideoId(video2Result[0].id);
    expect(result2).not.toBeNull();
    expect(result2!.id).toBe(finalOutput2Result[0].id);
    expect(result2!.final_video_path).toBe('/outputs/final_video2.mp4');
  });

  it('should return null for negative video ID', async () => {
    // Negative IDs are valid input but won't match any records
    const result = await getFinalOutputByVideoId(-1);
    expect(result).toBeNull();
  });
});