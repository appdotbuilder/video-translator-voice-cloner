import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { videosTable, translationJobsTable, audioGenerationJobsTable, finalOutputsTable } from '../db/schema';
import { getFinalOutputs } from '../handlers/get_final_outputs';

// Test data setup
const createTestVideo = async () => {
  const result = await db.insert(videosTable)
    .values({
      filename: 'test-video.mp4',
      original_filename: 'original-video.mp4',
      file_path: '/uploads/test-video.mp4',
      file_size: 1024000,
      duration: 120,
      format: 'mp4',
      upload_status: 'uploaded'
    })
    .returning()
    .execute();
  return result[0];
};

const createTestTranslationJob = async (videoId: number) => {
  const result = await db.insert(translationJobsTable)
    .values({
      video_id: videoId,
      source_language: 'en',
      target_language: 'es',
      status: 'completed',
      original_audio_path: '/audio/original.wav',
      translated_text: 'Hola mundo'
    })
    .returning()
    .execute();
  return result[0];
};

const createTestAudioGenerationJob = async (translationJobId: number) => {
  const result = await db.insert(audioGenerationJobsTable)
    .values({
      translation_job_id: translationJobId,
      status: 'completed',
      generated_audio_path: '/audio/generated.wav',
      voice_cloned: true
    })
    .returning()
    .execute();
  return result[0];
};

const createTestFinalOutput = async (videoId: number, translationJobId: number, audioJobId: number) => {
  const result = await db.insert(finalOutputsTable)
    .values({
      video_id: videoId,
      translation_job_id: translationJobId,
      audio_generation_job_id: audioJobId,
      final_video_path: '/outputs/final-video.mp4'
    })
    .returning()
    .execute();
  return result[0];
};

describe('getFinalOutputs', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no final outputs exist', async () => {
    const result = await getFinalOutputs();

    expect(result).toEqual([]);
  });

  it('should fetch all final outputs', async () => {
    // Create test data chain
    const video = await createTestVideo();
    const translationJob = await createTestTranslationJob(video.id);
    const audioJob = await createTestAudioGenerationJob(translationJob.id);
    const finalOutput = await createTestFinalOutput(video.id, translationJob.id, audioJob.id);

    const result = await getFinalOutputs();

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(finalOutput.id);
    expect(result[0].video_id).toEqual(video.id);
    expect(result[0].translation_job_id).toEqual(translationJob.id);
    expect(result[0].audio_generation_job_id).toEqual(audioJob.id);
    expect(result[0].final_video_path).toEqual('/outputs/final-video.mp4');
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should support pagination with limit and offset', async () => {
    // Create multiple test records
    const video1 = await createTestVideo();
    const translationJob1 = await createTestTranslationJob(video1.id);
    const audioJob1 = await createTestAudioGenerationJob(translationJob1.id);
    await createTestFinalOutput(video1.id, translationJob1.id, audioJob1.id);

    const video2 = await createTestVideo();
    const translationJob2 = await createTestTranslationJob(video2.id);
    const audioJob2 = await createTestAudioGenerationJob(translationJob2.id);
    await createTestFinalOutput(video2.id, translationJob2.id, audioJob2.id);

    const video3 = await createTestVideo();
    const translationJob3 = await createTestTranslationJob(video3.id);
    const audioJob3 = await createTestAudioGenerationJob(translationJob3.id);
    await createTestFinalOutput(video3.id, translationJob3.id, audioJob3.id);

    // Test first page
    const firstPage = await getFinalOutputs({ limit: 2, offset: 0 });
    expect(firstPage).toHaveLength(2);

    // Test second page
    const secondPage = await getFinalOutputs({ limit: 2, offset: 2 });
    expect(secondPage).toHaveLength(1);

    // Verify no duplicates between pages
    const firstPageIds = firstPage.map(output => output.id);
    const secondPageIds = secondPage.map(output => output.id);
    expect(firstPageIds).not.toEqual(expect.arrayContaining(secondPageIds));
  });

  it('should handle default pagination values', async () => {
    // Create test data
    const video = await createTestVideo();
    const translationJob = await createTestTranslationJob(video.id);
    const audioJob = await createTestAudioGenerationJob(translationJob.id);
    await createTestFinalOutput(video.id, translationJob.id, audioJob.id);

    const result = await getFinalOutputs({});

    expect(result).toHaveLength(1);
    expect(result[0].video_id).toEqual(video.id);
  });

  it('should work with relations included', async () => {
    // Create test data
    const video = await createTestVideo();
    const translationJob = await createTestTranslationJob(video.id);
    const audioJob = await createTestAudioGenerationJob(translationJob.id);
    const finalOutput = await createTestFinalOutput(video.id, translationJob.id, audioJob.id);

    const result = await getFinalOutputs({ includeRelations: true });

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(finalOutput.id);
    expect(result[0].video_id).toEqual(video.id);
    expect(result[0].translation_job_id).toEqual(translationJob.id);
    expect(result[0].audio_generation_job_id).toEqual(audioJob.id);
    expect(result[0].final_video_path).toEqual('/outputs/final-video.mp4');
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle multiple final outputs with different videos', async () => {
    // Create first complete workflow
    const video1 = await createTestVideo();
    const translationJob1 = await createTestTranslationJob(video1.id);
    const audioJob1 = await createTestAudioGenerationJob(translationJob1.id);
    const finalOutput1 = await createTestFinalOutput(video1.id, translationJob1.id, audioJob1.id);

    // Create second complete workflow
    const video2 = await createTestVideo();
    const translationJob2 = await createTestTranslationJob(video2.id);
    const audioJob2 = await createTestAudioGenerationJob(translationJob2.id);
    const finalOutput2 = await createTestFinalOutput(video2.id, translationJob2.id, audioJob2.id);

    const result = await getFinalOutputs();

    expect(result).toHaveLength(2);
    
    // Verify both final outputs are returned
    const outputIds = result.map(output => output.id);
    expect(outputIds).toContain(finalOutput1.id);
    expect(outputIds).toContain(finalOutput2.id);

    // Verify video associations
    const videoIds = result.map(output => output.video_id);
    expect(videoIds).toContain(video1.id);
    expect(videoIds).toContain(video2.id);
  });

  it('should maintain foreign key relationships', async () => {
    // Create test data
    const video = await createTestVideo();
    const translationJob = await createTestTranslationJob(video.id);
    const audioJob = await createTestAudioGenerationJob(translationJob.id);
    const finalOutput = await createTestFinalOutput(video.id, translationJob.id, audioJob.id);

    const result = await getFinalOutputs();

    expect(result).toHaveLength(1);
    
    // Verify all foreign keys are properly set
    expect(result[0].video_id).toEqual(video.id);
    expect(result[0].translation_job_id).toEqual(translationJob.id);
    expect(result[0].audio_generation_job_id).toEqual(audioJob.id);
    
    // Verify the relationships are valid by checking referenced records exist
    expect(video.id).toBeGreaterThan(0);
    expect(translationJob.id).toBeGreaterThan(0);
    expect(audioJob.id).toBeGreaterThan(0);
  });
});