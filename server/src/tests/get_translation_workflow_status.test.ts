import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { videosTable, translationJobsTable, audioGenerationJobsTable, finalOutputsTable } from '../db/schema';
import { getTranslationWorkflowStatus, type WorkflowStatus } from '../handlers/get_translation_workflow_status';

// Helper function to create test video
async function createTestVideo(uploadStatus: 'pending' | 'uploaded' | 'processing' | 'failed' = 'uploaded') {
    const result = await db.insert(videosTable)
        .values({
            filename: 'test-video.mp4',
            original_filename: 'original-test.mp4',
            file_path: '/uploads/test-video.mp4',
            file_size: 1024000,
            duration: 120,
            format: 'mp4',
            upload_status: uploadStatus
        })
        .returning()
        .execute();

    return result[0];
}

// Helper function to create test translation job
async function createTestTranslationJob(
    videoId: number, 
    status: 'pending' | 'extracting_audio' | 'translating' | 'completed' | 'failed' = 'pending'
) {
    const result = await db.insert(translationJobsTable)
        .values({
            video_id: videoId,
            source_language: 'en',
            target_language: 'es',
            status: status,
            original_audio_path: status !== 'pending' ? '/audio/original.wav' : null,
            translated_text: status === 'completed' ? 'Translated text here' : null,
            started_at: status !== 'pending' ? new Date() : null,
            completed_at: status === 'completed' ? new Date() : null
        })
        .returning()
        .execute();

    return result[0];
}

// Helper function to create test audio generation job
async function createTestAudioGenerationJob(
    translationJobId: number,
    status: 'pending' | 'generating' | 'completed' | 'failed' = 'pending'
) {
    const result = await db.insert(audioGenerationJobsTable)
        .values({
            translation_job_id: translationJobId,
            status: status,
            voice_cloned: true,
            generated_audio_path: status === 'completed' ? '/audio/generated.wav' : null,
            started_at: status !== 'pending' ? new Date() : null,
            completed_at: status === 'completed' ? new Date() : null
        })
        .returning()
        .execute();

    return result[0];
}

// Helper function to create test final output
async function createTestFinalOutput(videoId: number, translationJobId: number, audioGenerationJobId: number) {
    const result = await db.insert(finalOutputsTable)
        .values({
            video_id: videoId,
            translation_job_id: translationJobId,
            audio_generation_job_id: audioGenerationJobId,
            final_video_path: '/outputs/final-video.mp4'
        })
        .returning()
        .execute();

    return result[0];
}

describe('getTranslationWorkflowStatus', () => {
    beforeEach(createDB);
    afterEach(resetDB);

    it('should return not_started status for non-existent video', async () => {
        const result = await getTranslationWorkflowStatus(999);

        expect(result.video).toBeNull();
        expect(result.translationJob).toBeNull();
        expect(result.audioGenerationJob).toBeNull();
        expect(result.finalOutput).toBeNull();
        expect(result.overallStatus).toBe('not_started');
        expect(result.progress).toBe(0);
    });

    it('should return uploading status for pending video upload', async () => {
        const video = await createTestVideo('pending');
        
        const result = await getTranslationWorkflowStatus(video.id);

        expect(result.video?.id).toBe(video.id);
        expect(result.translationJob).toBeNull();
        expect(result.audioGenerationJob).toBeNull();
        expect(result.finalOutput).toBeNull();
        expect(result.overallStatus).toBe('uploading');
        expect(result.progress).toBe(10);
    });

    it('should return uploading status for processing video upload', async () => {
        const video = await createTestVideo('processing');
        
        const result = await getTranslationWorkflowStatus(video.id);

        expect(result.video?.id).toBe(video.id);
        expect(result.overallStatus).toBe('uploading');
        expect(result.progress).toBe(10);
    });

    it('should return failed status for failed video upload', async () => {
        const video = await createTestVideo('failed');
        
        const result = await getTranslationWorkflowStatus(video.id);

        expect(result.video?.id).toBe(video.id);
        expect(result.overallStatus).toBe('failed');
        expect(result.progress).toBe(0);
    });

    it('should return not_started status for uploaded video with no translation job', async () => {
        const video = await createTestVideo('uploaded');
        
        const result = await getTranslationWorkflowStatus(video.id);

        expect(result.video?.id).toBe(video.id);
        expect(result.translationJob).toBeNull();
        expect(result.audioGenerationJob).toBeNull();
        expect(result.finalOutput).toBeNull();
        expect(result.overallStatus).toBe('not_started');
        expect(result.progress).toBe(25);
    });

    it('should return translating status for pending translation job', async () => {
        const video = await createTestVideo('uploaded');
        const translationJob = await createTestTranslationJob(video.id, 'pending');
        
        const result = await getTranslationWorkflowStatus(video.id);

        expect(result.video?.id).toBe(video.id);
        expect(result.translationJob?.id).toBe(translationJob.id);
        expect(result.audioGenerationJob).toBeNull();
        expect(result.finalOutput).toBeNull();
        expect(result.overallStatus).toBe('translating');
        expect(result.progress).toBe(50);
    });

    it('should return translating status for extracting_audio translation job', async () => {
        const video = await createTestVideo('uploaded');
        const translationJob = await createTestTranslationJob(video.id, 'extracting_audio');
        
        const result = await getTranslationWorkflowStatus(video.id);

        expect(result.translationJob?.status).toBe('extracting_audio');
        expect(result.overallStatus).toBe('translating');
        expect(result.progress).toBe(50);
    });

    it('should return translating status for translating translation job', async () => {
        const video = await createTestVideo('uploaded');
        const translationJob = await createTestTranslationJob(video.id, 'translating');
        
        const result = await getTranslationWorkflowStatus(video.id);

        expect(result.translationJob?.status).toBe('translating');
        expect(result.overallStatus).toBe('translating');
        expect(result.progress).toBe(50);
    });

    it('should return failed status for failed translation job', async () => {
        const video = await createTestVideo('uploaded');
        const translationJob = await createTestTranslationJob(video.id, 'failed');
        
        const result = await getTranslationWorkflowStatus(video.id);

        expect(result.translationJob?.status).toBe('failed');
        expect(result.overallStatus).toBe('failed');
        expect(result.progress).toBe(25);
    });

    it('should return translating status for completed translation job with no audio generation job', async () => {
        const video = await createTestVideo('uploaded');
        const translationJob = await createTestTranslationJob(video.id, 'completed');
        
        const result = await getTranslationWorkflowStatus(video.id);

        expect(result.translationJob?.status).toBe('completed');
        expect(result.audioGenerationJob).toBeNull();
        expect(result.overallStatus).toBe('translating');
        expect(result.progress).toBe(75);
    });

    it('should return generating_audio status for pending audio generation job', async () => {
        const video = await createTestVideo('uploaded');
        const translationJob = await createTestTranslationJob(video.id, 'completed');
        const audioGenerationJob = await createTestAudioGenerationJob(translationJob.id, 'pending');
        
        const result = await getTranslationWorkflowStatus(video.id);

        expect(result.translationJob?.status).toBe('completed');
        expect(result.audioGenerationJob?.id).toBe(audioGenerationJob.id);
        expect(result.audioGenerationJob?.status).toBe('pending');
        expect(result.overallStatus).toBe('generating_audio');
        expect(result.progress).toBe(85);
    });

    it('should return generating_audio status for generating audio generation job', async () => {
        const video = await createTestVideo('uploaded');
        const translationJob = await createTestTranslationJob(video.id, 'completed');
        const audioGenerationJob = await createTestAudioGenerationJob(translationJob.id, 'generating');
        
        const result = await getTranslationWorkflowStatus(video.id);

        expect(result.audioGenerationJob?.status).toBe('generating');
        expect(result.overallStatus).toBe('generating_audio');
        expect(result.progress).toBe(85);
    });

    it('should return failed status for failed audio generation job', async () => {
        const video = await createTestVideo('uploaded');
        const translationJob = await createTestTranslationJob(video.id, 'completed');
        const audioGenerationJob = await createTestAudioGenerationJob(translationJob.id, 'failed');
        
        const result = await getTranslationWorkflowStatus(video.id);

        expect(result.audioGenerationJob?.status).toBe('failed');
        expect(result.overallStatus).toBe('failed');
        expect(result.progress).toBe(75);
    });

    it('should return generating_audio status for completed audio generation job with no final output', async () => {
        const video = await createTestVideo('uploaded');
        const translationJob = await createTestTranslationJob(video.id, 'completed');
        const audioGenerationJob = await createTestAudioGenerationJob(translationJob.id, 'completed');
        
        const result = await getTranslationWorkflowStatus(video.id);

        expect(result.audioGenerationJob?.status).toBe('completed');
        expect(result.finalOutput).toBeNull();
        expect(result.overallStatus).toBe('generating_audio');
        expect(result.progress).toBe(95);
    });

    it('should return completed status when final output exists', async () => {
        const video = await createTestVideo('uploaded');
        const translationJob = await createTestTranslationJob(video.id, 'completed');
        const audioGenerationJob = await createTestAudioGenerationJob(translationJob.id, 'completed');
        const finalOutput = await createTestFinalOutput(video.id, translationJob.id, audioGenerationJob.id);
        
        const result = await getTranslationWorkflowStatus(video.id);

        expect(result.video?.id).toBe(video.id);
        expect(result.translationJob?.id).toBe(translationJob.id);
        expect(result.audioGenerationJob?.id).toBe(audioGenerationJob.id);
        expect(result.finalOutput?.id).toBe(finalOutput.id);
        expect(result.overallStatus).toBe('completed');
        expect(result.progress).toBe(100);
    });

    it('should return the most recent translation job when multiple exist', async () => {
        const video = await createTestVideo('uploaded');
        
        // Create older translation job
        const olderJob = await createTestTranslationJob(video.id, 'failed');
        
        // Wait a bit to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Create newer translation job
        const newerJob = await createTestTranslationJob(video.id, 'completed');
        
        const result = await getTranslationWorkflowStatus(video.id);

        expect(result.translationJob?.id).toBe(newerJob.id);
        expect(result.translationJob?.status).toBe('completed');
        expect(result.overallStatus).not.toBe('failed'); // Should not use older failed job
    });

    it('should return the most recent audio generation job when multiple exist', async () => {
        const video = await createTestVideo('uploaded');
        const translationJob = await createTestTranslationJob(video.id, 'completed');
        
        // Create older audio generation job
        const olderAudioJob = await createTestAudioGenerationJob(translationJob.id, 'failed');
        
        // Wait a bit to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Create newer audio generation job
        const newerAudioJob = await createTestAudioGenerationJob(translationJob.id, 'completed');
        
        const result = await getTranslationWorkflowStatus(video.id);

        expect(result.audioGenerationJob?.id).toBe(newerAudioJob.id);
        expect(result.audioGenerationJob?.status).toBe('completed');
        expect(result.overallStatus).not.toBe('failed'); // Should not use older failed job
    });

    it('should handle workflow with all components present', async () => {
        const video = await createTestVideo('uploaded');
        const translationJob = await createTestTranslationJob(video.id, 'completed');
        const audioGenerationJob = await createTestAudioGenerationJob(translationJob.id, 'completed');
        const finalOutput = await createTestFinalOutput(video.id, translationJob.id, audioGenerationJob.id);
        
        const result = await getTranslationWorkflowStatus(video.id);

        // Verify all components are present
        expect(result.video).not.toBeNull();
        expect(result.translationJob).not.toBeNull();
        expect(result.audioGenerationJob).not.toBeNull();
        expect(result.finalOutput).not.toBeNull();

        // Verify specific fields
        expect(result.video?.filename).toBe('test-video.mp4');
        expect(result.translationJob?.source_language).toBe('en');
        expect(result.translationJob?.target_language).toBe('es');
        expect(result.audioGenerationJob?.voice_cloned).toBe(true);
        expect(result.finalOutput?.final_video_path).toBe('/outputs/final-video.mp4');
        
        expect(result.overallStatus).toBe('completed');
        expect(result.progress).toBe(100);
    });
});