import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { videosTable } from '../db/schema';
import { type CreateVideoInput } from '../schema';
import { createVideo } from '../handlers/create_video';
import { eq } from 'drizzle-orm';

// Test input data
const testInput: CreateVideoInput = {
  filename: 'video_123.mp4',
  original_filename: 'my-awesome-video.mp4',
  file_path: '/uploads/videos/video_123.mp4',
  file_size: 52428800, // 50MB in bytes
  duration: 150, // 2 minutes 30 seconds (in whole seconds)
  format: 'mp4'
};

const testInputWithNullDuration: CreateVideoInput = {
  filename: 'video_456.avi',
  original_filename: 'unprocessed-video.avi',
  file_path: '/uploads/videos/video_456.avi',
  file_size: 104857600, // 100MB in bytes
  duration: null, // Not yet processed
  format: 'avi'
};

describe('createVideo', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a video with all fields', async () => {
    const result = await createVideo(testInput);

    // Verify all fields are correctly set
    expect(result.filename).toEqual('video_123.mp4');
    expect(result.original_filename).toEqual('my-awesome-video.mp4');
    expect(result.file_path).toEqual('/uploads/videos/video_123.mp4');
    expect(result.file_size).toEqual(52428800);
    expect(result.duration).toEqual(150);
    expect(result.format).toEqual('mp4');
    expect(result.upload_status).toEqual('pending');
    expect(result.id).toBeDefined();
    expect(result.uploaded_at).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should create a video with null duration', async () => {
    const result = await createVideo(testInputWithNullDuration);

    // Verify null duration is handled correctly
    expect(result.filename).toEqual('video_456.avi');
    expect(result.original_filename).toEqual('unprocessed-video.avi');
    expect(result.file_path).toEqual('/uploads/videos/video_456.avi');
    expect(result.file_size).toEqual(104857600);
    expect(result.duration).toBeNull();
    expect(result.format).toEqual('avi');
    expect(result.upload_status).toEqual('pending');
    expect(result.id).toBeDefined();
    expect(result.uploaded_at).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save video to database correctly', async () => {
    const result = await createVideo(testInput);

    // Query the database to verify record was saved
    const videos = await db.select()
      .from(videosTable)
      .where(eq(videosTable.id, result.id))
      .execute();

    expect(videos).toHaveLength(1);
    const savedVideo = videos[0];

    expect(savedVideo.filename).toEqual('video_123.mp4');
    expect(savedVideo.original_filename).toEqual('my-awesome-video.mp4');
    expect(savedVideo.file_path).toEqual('/uploads/videos/video_123.mp4');
    expect(savedVideo.file_size).toEqual(52428800);
    expect(savedVideo.duration).toEqual(150);
    expect(savedVideo.format).toEqual('mp4');
    expect(savedVideo.upload_status).toEqual('pending');
    expect(savedVideo.uploaded_at).toBeInstanceOf(Date);
    expect(savedVideo.created_at).toBeInstanceOf(Date);
  });

  it('should set default upload_status to pending', async () => {
    const result = await createVideo(testInput);

    // Verify default status is applied
    expect(result.upload_status).toEqual('pending');

    // Verify in database too
    const videos = await db.select()
      .from(videosTable)
      .where(eq(videosTable.id, result.id))
      .execute();

    expect(videos[0].upload_status).toEqual('pending');
  });

  it('should generate unique IDs for multiple videos', async () => {
    const result1 = await createVideo(testInput);
    const result2 = await createVideo(testInputWithNullDuration);

    // Verify unique IDs are generated
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.id).toBeGreaterThan(0);
    expect(result2.id).toBeGreaterThan(0);

    // Verify both records exist in database
    const videos = await db.select()
      .from(videosTable)
      .execute();

    expect(videos).toHaveLength(2);
  });

  it('should handle different video formats correctly', async () => {
    const formats = ['mp4', 'avi', 'mov', 'mkv', 'webm'];
    
    for (let i = 0; i < formats.length; i++) {
      const format = formats[i];
      const input = {
        ...testInput,
        filename: `video_${i}.${format}`,
        format: format
      };

      const result = await createVideo(input);
      expect(result.format).toEqual(format);
      expect(result.filename).toEqual(`video_${i}.${format}`);
    }

    // Verify all videos were saved
    const videos = await db.select()
      .from(videosTable)
      .execute();

    expect(videos).toHaveLength(formats.length);
  });

  it('should preserve timestamp precision', async () => {
    const beforeCreation = new Date();
    const result = await createVideo(testInput);
    const afterCreation = new Date();

    // Verify timestamps are within reasonable range
    expect(result.uploaded_at.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
    expect(result.uploaded_at.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    expect(result.created_at.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
    expect(result.created_at.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
  });
});