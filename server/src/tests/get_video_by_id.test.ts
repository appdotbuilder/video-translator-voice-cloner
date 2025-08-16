import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { videosTable } from '../db/schema';
import { type CreateVideoInput } from '../schema';
import { getVideoById } from '../handlers/get_video_by_id';

// Test video data
const testVideoInput: CreateVideoInput = {
  filename: 'test-video-123.mp4',
  original_filename: 'my-video.mp4',
  file_path: '/uploads/videos/test-video-123.mp4',
  file_size: 15728640, // ~15MB
  duration: 120, // 2 minutes
  format: 'mp4'
};

describe('getVideoById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return video when found', async () => {
    // Create a test video first
    const insertResult = await db.insert(videosTable)
      .values({
        filename: testVideoInput.filename,
        original_filename: testVideoInput.original_filename,
        file_path: testVideoInput.file_path,
        file_size: testVideoInput.file_size,
        duration: testVideoInput.duration,
        format: testVideoInput.format,
        upload_status: 'uploaded'
      })
      .returning()
      .execute();

    const createdVideo = insertResult[0];

    // Test the handler
    const result = await getVideoById(createdVideo.id);

    // Verify the result
    expect(result).not.toBeNull();
    expect(result!.id).toBe(createdVideo.id);
    expect(result!.filename).toBe('test-video-123.mp4');
    expect(result!.original_filename).toBe('my-video.mp4');
    expect(result!.file_path).toBe('/uploads/videos/test-video-123.mp4');
    expect(result!.file_size).toBe(15728640);
    expect(result!.duration).toBe(120);
    expect(result!.format).toBe('mp4');
    expect(result!.upload_status).toBe('uploaded');
    expect(result!.uploaded_at).toBeInstanceOf(Date);
    expect(result!.created_at).toBeInstanceOf(Date);
  });

  it('should return null when video not found', async () => {
    const result = await getVideoById(999999);
    expect(result).toBeNull();
  });

  it('should handle video with null duration', async () => {
    // Create video without duration
    const insertResult = await db.insert(videosTable)
      .values({
        filename: 'no-duration.mp4',
        original_filename: 'original.mp4',
        file_path: '/uploads/videos/no-duration.mp4',
        file_size: 1024,
        duration: null, // Explicitly null
        format: 'mp4',
        upload_status: 'pending'
      })
      .returning()
      .execute();

    const createdVideo = insertResult[0];

    const result = await getVideoById(createdVideo.id);

    expect(result).not.toBeNull();
    expect(result!.duration).toBeNull();
    expect(result!.upload_status).toBe('pending');
  });

  it('should return video with different upload status', async () => {
    // Test with different statuses
    const statuses = ['pending', 'uploaded', 'processing', 'failed'] as const;

    for (const status of statuses) {
      const insertResult = await db.insert(videosTable)
        .values({
          filename: `${status}-video.mp4`,
          original_filename: 'test.mp4',
          file_path: `/uploads/${status}-video.mp4`,
          file_size: 1024,
          duration: 60,
          format: 'mp4',
          upload_status: status
        })
        .returning()
        .execute();

      const createdVideo = insertResult[0];
      const result = await getVideoById(createdVideo.id);

      expect(result).not.toBeNull();
      expect(result!.upload_status).toBe(status);
      expect(result!.filename).toBe(`${status}-video.mp4`);
    }
  });

  it('should handle various video formats', async () => {
    const formats = ['mp4', 'avi', 'mov', 'mkv', 'webm'];

    for (const format of formats) {
      const insertResult = await db.insert(videosTable)
        .values({
          filename: `test.${format}`,
          original_filename: `original.${format}`,
          file_path: `/uploads/test.${format}`,
          file_size: 2048,
          duration: 30,
          format: format,
          upload_status: 'uploaded'
        })
        .returning()
        .execute();

      const createdVideo = insertResult[0];
      const result = await getVideoById(createdVideo.id);

      expect(result).not.toBeNull();
      expect(result!.format).toBe(format);
      expect(result!.filename).toBe(`test.${format}`);
    }
  });

  it('should preserve timestamp precision', async () => {
    const insertResult = await db.insert(videosTable)
      .values({
        filename: 'timestamp-test.mp4',
        original_filename: 'test.mp4',
        file_path: '/uploads/timestamp-test.mp4',
        file_size: 1024,
        duration: 60,
        format: 'mp4',
        upload_status: 'uploaded'
      })
      .returning()
      .execute();

    const createdVideo = insertResult[0];
    const result = await getVideoById(createdVideo.id);

    expect(result).not.toBeNull();
    
    // Verify timestamps are Date objects and close to current time
    const now = new Date();
    const timeDiff = now.getTime() - result!.created_at.getTime();
    
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.uploaded_at).toBeInstanceOf(Date);
    expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
  });
});