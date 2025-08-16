import { db } from '../db';
import { videosTable, translationJobsTable, audioGenerationJobsTable, finalOutputsTable } from '../db/schema';
import { type Video, type TranslationJob, type AudioGenerationJob, type FinalOutput } from '../schema';
import { eq, desc } from 'drizzle-orm';

export interface WorkflowStatus {
    video: Video | null;
    translationJob: TranslationJob | null;
    audioGenerationJob: AudioGenerationJob | null;
    finalOutput: FinalOutput | null;
    overallStatus: 'not_started' | 'uploading' | 'translating' | 'generating_audio' | 'completed' | 'failed';
    progress: number; // 0-100
}

export async function getTranslationWorkflowStatus(videoId: number): Promise<WorkflowStatus> {
    try {
        // Fetch the video
        const videos = await db.select()
            .from(videosTable)
            .where(eq(videosTable.id, videoId))
            .execute();

        const video = videos.length > 0 ? videos[0] : null;

        if (!video) {
            return {
                video: null,
                translationJob: null,
                audioGenerationJob: null,
                finalOutput: null,
                overallStatus: 'not_started',
                progress: 0
            };
        }

        // Fetch the most recent translation job for this video
        const translationJobs = await db.select()
            .from(translationJobsTable)
            .where(eq(translationJobsTable.video_id, videoId))
            .orderBy(desc(translationJobsTable.created_at))
            .limit(1)
            .execute();

        const translationJob = translationJobs.length > 0 ? translationJobs[0] : null;

        // Fetch the most recent audio generation job if translation job exists
        let audioGenerationJob: AudioGenerationJob | null = null;
        if (translationJob) {
            const audioJobs = await db.select()
                .from(audioGenerationJobsTable)
                .where(eq(audioGenerationJobsTable.translation_job_id, translationJob.id))
                .orderBy(desc(audioGenerationJobsTable.created_at))
                .limit(1)
                .execute();

            audioGenerationJob = audioJobs.length > 0 ? audioJobs[0] : null;
        }

        // Fetch the final output if it exists
        const finalOutputs = await db.select()
            .from(finalOutputsTable)
            .where(eq(finalOutputsTable.video_id, videoId))
            .orderBy(desc(finalOutputsTable.created_at))
            .limit(1)
            .execute();

        const finalOutput = finalOutputs.length > 0 ? finalOutputs[0] : null;

        // Determine overall status and progress
        const { overallStatus, progress } = calculateWorkflowStatus(
            video,
            translationJob,
            audioGenerationJob,
            finalOutput
        );

        return {
            video,
            translationJob,
            audioGenerationJob,
            finalOutput,
            overallStatus,
            progress
        };
    } catch (error) {
        console.error('Failed to get translation workflow status:', error);
        throw error;
    }
}

function calculateWorkflowStatus(
    video: Video,
    translationJob: TranslationJob | null,
    audioGenerationJob: AudioGenerationJob | null,
    finalOutput: FinalOutput | null
): { overallStatus: WorkflowStatus['overallStatus']; progress: number } {
    // If final output exists, workflow is completed
    if (finalOutput) {
        return { overallStatus: 'completed', progress: 100 };
    }

    // Check for failed states
    if (video.upload_status === 'failed') {
        return { overallStatus: 'failed', progress: 0 };
    }

    if (translationJob?.status === 'failed') {
        return { overallStatus: 'failed', progress: 25 };
    }

    if (audioGenerationJob?.status === 'failed') {
        return { overallStatus: 'failed', progress: 75 };
    }

    // Check upload phase
    if (video.upload_status === 'pending' || video.upload_status === 'processing') {
        return { overallStatus: 'uploading', progress: 10 };
    }

    // Video uploaded successfully
    if (video.upload_status === 'uploaded') {
        if (!translationJob) {
            return { overallStatus: 'not_started', progress: 25 };
        }

        // Translation phase
        if (translationJob.status === 'pending' || 
            translationJob.status === 'extracting_audio' || 
            translationJob.status === 'translating') {
            return { overallStatus: 'translating', progress: 50 };
        }

        // Translation completed
        if (translationJob.status === 'completed') {
            if (!audioGenerationJob) {
                return { overallStatus: 'translating', progress: 75 };
            }

            // Audio generation phase
            if (audioGenerationJob.status === 'pending' || 
                audioGenerationJob.status === 'generating') {
                return { overallStatus: 'generating_audio', progress: 85 };
            }

            // Audio generation completed but no final output yet
            if (audioGenerationJob.status === 'completed') {
                return { overallStatus: 'generating_audio', progress: 95 };
            }
        }
    }

    // Default fallback
    return { overallStatus: 'not_started', progress: 0 };
}