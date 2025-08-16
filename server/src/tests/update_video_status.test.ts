import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { videosTable } from '../db/schema';
import { type UpdateVideoStatusInput, type CreateVideoInput } from '../schema';
import { updateVideoStatus } from '../handlers/update_video_status';
import { eq } from 'drizzle-orm';

// Helper function to create a test video
const createTestVideo = async (): Promise<number> => {
  const testVideoInput: CreateVideoInput = {
    filename: 'test_video.mp4',
    original_filename: 'user_test_video.mp4',
    file_path: '/uploads/test_video.mp4',
    file_size: 1048576, // 1MB
    duration: 120, // 2 minutes
    format: 'mp4'
  };

  const result = await db.insert(videosTable)
    .values({
      filename: testVideoInput.filename,
      original_filename: testVideoInput.original_filename,
      file_path: testVideoInput.file_path,
      file_size: testVideoInput.file_size,
      duration: testVideoInput.duration,
      format: testVideoInput.format,
      upload_status: 'pending'
    })
    .returning()
    .execute();

  return result[0].id;
};

describe('updateVideoStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update video upload status', async () => {
    const videoId = await createTestVideo();
    
    const updateInput: UpdateVideoStatusInput = {
      id: videoId,
      upload_status: 'uploaded'
    };

    const result = await updateVideoStatus(updateInput);

    // Verify the returned data
    expect(result.id).toEqual(videoId);
    expect(result.upload_status).toEqual('uploaded');
    expect(result.filename).toEqual('test_video.mp4');
    expect(result.original_filename).toEqual('user_test_video.mp4');
    expect(result.file_path).toEqual('/uploads/test_video.mp4');
    expect(result.file_size).toEqual(1048576);
    expect(result.duration).toEqual(120);
    expect(result.format).toEqual('mp4');
    expect(result.uploaded_at).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should update video status with optional fields', async () => {
    const videoId = await createTestVideo();
    
    const updateInput: UpdateVideoStatusInput = {
      id: videoId,
      upload_status: 'processing',
      duration: 180, // 3 minutes
      format: 'avi'
    };

    const result = await updateVideoStatus(updateInput);

    // Verify all fields were updated
    expect(result.id).toEqual(videoId);
    expect(result.upload_status).toEqual('processing');
    expect(result.duration).toEqual(180);
    expect(result.format).toEqual('avi');
  });

  it('should persist changes to database', async () => {
    const videoId = await createTestVideo();
    
    const updateInput: UpdateVideoStatusInput = {
      id: videoId,
      upload_status: 'uploaded',
      duration: 240,
      format: 'webm'
    };

    await updateVideoStatus(updateInput);

    // Query database directly to verify persistence
    const videos = await db.select()
      .from(videosTable)
      .where(eq(videosTable.id, videoId))
      .execute();

    expect(videos).toHaveLength(1);
    const video = videos[0];
    expect(video.upload_status).toEqual('uploaded');
    expect(video.duration).toEqual(240);
    expect(video.format).toEqual('webm');
  });

  it('should update only provided fields', async () => {
    const videoId = await createTestVideo();
    
    // Update only status, leaving other fields unchanged
    const updateInput: UpdateVideoStatusInput = {
      id: videoId,
      upload_status: 'failed'
    };

    const result = await updateVideoStatus(updateInput);

    // Verify status was updated but original values preserved
    expect(result.upload_status).toEqual('failed');
    expect(result.duration).toEqual(120); // Original value
    expect(result.format).toEqual('mp4'); // Original value
  });

  it('should handle null duration correctly', async () => {
    const videoId = await createTestVideo();
    
    const updateInput: UpdateVideoStatusInput = {
      id: videoId,
      upload_status: 'uploaded',
      duration: undefined // This should not update the duration field
    };

    const result = await updateVideoStatus(updateInput);

    expect(result.upload_status).toEqual('uploaded');
    expect(result.duration).toEqual(120); // Original value should be preserved
  });

  it('should throw error when video not found', async () => {
    const updateInput: UpdateVideoStatusInput = {
      id: 99999, // Non-existent ID
      upload_status: 'uploaded'
    };

    await expect(updateVideoStatus(updateInput)).rejects.toThrow(/video with id 99999 not found/i);
  });

  it('should handle different status values correctly', async () => {
    const videoId = await createTestVideo();
    
    // Test all valid status values
    const statusValues = ['pending', 'uploaded', 'processing', 'failed'] as const;
    
    for (const status of statusValues) {
      const updateInput: UpdateVideoStatusInput = {
        id: videoId,
        upload_status: status
      };

      const result = await updateVideoStatus(updateInput);
      expect(result.upload_status).toEqual(status);
    }
  });

  it('should preserve unchanged fields across updates', async () => {
    const videoId = await createTestVideo();
    
    // First update: change status and duration
    await updateVideoStatus({
      id: videoId,
      upload_status: 'uploaded',
      duration: 300
    });

    // Second update: change only format
    const result = await updateVideoStatus({
      id: videoId,
      upload_status: 'processing',
      format: 'mkv'
    });

    // Verify all changes are preserved
    expect(result.upload_status).toEqual('processing');
    expect(result.duration).toEqual(300); // From first update
    expect(result.format).toEqual('mkv'); // From second update
  });
});