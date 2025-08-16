import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { videosTable } from '../db/schema';
import { type GetVideosQuery, type CreateVideoInput } from '../schema';
import { getVideos } from '../handlers/get_videos';

// Test video inputs
const testVideo1: CreateVideoInput = {
  filename: 'test_video_1.mp4',
  original_filename: 'Original Video 1.mp4',
  file_path: '/uploads/test_video_1.mp4',
  file_size: 1024000,
  duration: 120,
  format: 'mp4'
};

const testVideo2: CreateVideoInput = {
  filename: 'test_video_2.avi',
  original_filename: 'Original Video 2.avi',
  file_path: '/uploads/test_video_2.avi',
  file_size: 2048000,
  duration: 240,
  format: 'avi'
};

const testVideo3: CreateVideoInput = {
  filename: 'test_video_3.mov',
  original_filename: 'Original Video 3.mov',
  file_path: '/uploads/test_video_3.mov',
  file_size: 3072000,
  duration: null,
  format: 'mov'
};

describe('getVideos', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no videos exist', async () => {
    const result = await getVideos();

    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return all videos with default pagination', async () => {
    // Create test videos sequentially to ensure predictable ordering
    const video1Result = await db.insert(videosTable)
      .values({ ...testVideo1, upload_status: 'uploaded' })
      .returning()
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const video2Result = await db.insert(videosTable)
      .values({ ...testVideo2, upload_status: 'pending' })
      .returning()
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    const video3Result = await db.insert(videosTable)
      .values({ ...testVideo3, upload_status: 'processing' })
      .returning()
      .execute();

    const result = await getVideos();

    expect(result).toHaveLength(3);
    
    // Verify ordering by creation time (most recent first)
    expect(result[0].id).toEqual(video3Result[0].id); // Most recent
    expect(result[1].id).toEqual(video2Result[0].id);
    expect(result[2].id).toEqual(video1Result[0].id); // Oldest
    
    // Verify all fields are present and correctly typed
    result.forEach(video => {
      expect(video.id).toBeDefined();
      expect(typeof video.id).toBe('number');
      expect(typeof video.filename).toBe('string');
      expect(typeof video.original_filename).toBe('string');
      expect(typeof video.file_path).toBe('string');
      expect(typeof video.file_size).toBe('number');
      expect(typeof video.format).toBe('string');
      expect(['pending', 'uploaded', 'processing', 'failed']).toContain(video.upload_status);
      expect(video.created_at).toBeInstanceOf(Date);
      expect(video.uploaded_at).toBeInstanceOf(Date);
    });
  });

  it('should filter videos by upload status', async () => {
    // Create test videos sequentially
    const video1Result = await db.insert(videosTable)
      .values({ ...testVideo1, upload_status: 'uploaded' })
      .returning()
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(videosTable)
      .values({ ...testVideo2, upload_status: 'pending' })
      .returning()
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    const video3Result = await db.insert(videosTable)
      .values({ ...testVideo3, upload_status: 'uploaded' })
      .returning()
      .execute();

    const query: GetVideosQuery = {
      status: 'uploaded',
      limit: 10,
      offset: 0
    };

    const result = await getVideos(query);

    expect(result).toHaveLength(2);
    result.forEach(video => {
      expect(video.upload_status).toEqual('uploaded');
    });
    
    // Verify the correct videos are returned (ordered by creation date desc)
    expect(result[0].id).toEqual(video3Result[0].id); // Most recent uploaded
    expect(result[1].id).toEqual(video1Result[0].id); // Older uploaded
  });

  it('should apply pagination correctly', async () => {
    // Create 5 test videos sequentially
    const videoResults = [];
    for (let i = 0; i < 5; i++) {
      const videoInput = {
        filename: `test_video_${i + 1}.mp4`,
        original_filename: `Original Video ${i + 1}.mp4`,
        file_path: `/uploads/test_video_${i + 1}.mp4`,
        file_size: 1024000 + i * 100000,
        duration: 120 + i * 30,
        format: 'mp4',
        upload_status: 'uploaded' as const
      };

      const result = await db.insert(videosTable)
        .values(videoInput)
        .returning()
        .execute();
      
      videoResults.push(result[0]);
      
      // Small delay between inserts
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Test first page
    const firstPageQuery: GetVideosQuery = {
      limit: 2,
      offset: 0
    };

    const firstPage = await getVideos(firstPageQuery);
    expect(firstPage).toHaveLength(2);

    // Test second page
    const secondPageQuery: GetVideosQuery = {
      limit: 2,
      offset: 2
    };

    const secondPage = await getVideos(secondPageQuery);
    expect(secondPage).toHaveLength(2);

    // Ensure different records on each page
    const firstPageIds = firstPage.map(v => v.id);
    const secondPageIds = secondPage.map(v => v.id);
    
    expect(firstPageIds).not.toEqual(secondPageIds);

    // Test third page (should have 1 remaining video)
    const thirdPageQuery: GetVideosQuery = {
      limit: 2,
      offset: 4
    };

    const thirdPage = await getVideos(thirdPageQuery);
    expect(thirdPage).toHaveLength(1);
  });

  it('should handle pagination with status filter', async () => {
    // Create multiple videos with same status sequentially
    for (let i = 0; i < 4; i++) {
      const videoInput = {
        filename: `uploaded_video_${i + 1}.mp4`,
        original_filename: `Uploaded Video ${i + 1}.mp4`,
        file_path: `/uploads/uploaded_video_${i + 1}.mp4`,
        file_size: 1024000 + i * 100000,
        duration: 120,
        format: 'mp4',
        upload_status: 'uploaded' as const
      };

      await db.insert(videosTable)
        .values(videoInput)
        .execute();

      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Add one video with different status
    await db.insert(videosTable)
      .values({
        filename: 'pending_video.mp4',
        original_filename: 'Pending Video.mp4',
        file_path: '/uploads/pending_video.mp4',
        file_size: 2048000,
        duration: 180,
        format: 'mp4',
        upload_status: 'pending' as const
      })
      .execute();

    const query: GetVideosQuery = {
      status: 'uploaded',
      limit: 2,
      offset: 0
    };

    const result = await getVideos(query);

    expect(result).toHaveLength(2);
    result.forEach(video => {
      expect(video.upload_status).toEqual('uploaded');
    });
  });

  it('should return videos ordered by creation date descending', async () => {
    // Create videos sequentially with explicit delays
    const video1Result = await db.insert(videosTable)
      .values({ ...testVideo1, upload_status: 'uploaded' })
      .returning()
      .execute();

    // Delay to ensure different creation times
    await new Promise(resolve => setTimeout(resolve, 50));

    const video2Result = await db.insert(videosTable)
      .values({ ...testVideo2, upload_status: 'uploaded' })
      .returning()
      .execute();

    await new Promise(resolve => setTimeout(resolve, 50));

    const video3Result = await db.insert(videosTable)
      .values({ ...testVideo3, upload_status: 'uploaded' })
      .returning()
      .execute();

    const result = await getVideos();

    expect(result).toHaveLength(3);
    
    // Verify descending order by creation date using IDs (which are sequential)
    expect(result[0].id).toEqual(video3Result[0].id); // Most recent
    expect(result[1].id).toEqual(video2Result[0].id);
    expect(result[2].id).toEqual(video1Result[0].id); // Oldest
    
    // Verify actual timestamps are in descending order
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].created_at >= result[i + 1].created_at).toBe(true);
    }
  });

  it('should handle videos with null duration correctly', async () => {
    await db.insert(videosTable)
      .values({ ...testVideo3, upload_status: 'pending' })
      .execute();

    const result = await getVideos();

    expect(result).toHaveLength(1);
    expect(result[0].duration).toBeNull();
    expect(result[0].filename).toEqual('test_video_3.mov');
  });

  it('should use default pagination values when not provided', async () => {
    // Create more than 10 videos to test default limit
    for (let i = 0; i < 15; i++) {
      const videoInput = {
        filename: `test_video_${i + 1}.mp4`,
        original_filename: `Original Video ${i + 1}.mp4`,
        file_path: `/uploads/test_video_${i + 1}.mp4`,
        file_size: 1024000,
        duration: 120,
        format: 'mp4',
        upload_status: 'uploaded' as const
      };

      await db.insert(videosTable)
        .values(videoInput)
        .execute();
    }

    // Test with no query parameter (should use defaults)
    const result = await getVideos();

    expect(result).toHaveLength(10); // Default limit
    
    // Test with partial query object (missing limit/offset) - Zod will apply defaults
    const result2 = await getVideos({ status: 'uploaded' });
    
    expect(result2).toHaveLength(10); // Should still apply defaults
  });
});