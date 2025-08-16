import { z } from 'zod';

// Enum schemas for status tracking
export const uploadStatusSchema = z.enum(['pending', 'uploaded', 'processing', 'failed']);
export const translationStatusSchema = z.enum(['pending', 'extracting_audio', 'translating', 'completed', 'failed']);
export const audioGenerationStatusSchema = z.enum(['pending', 'generating', 'completed', 'failed']);

export type UploadStatus = z.infer<typeof uploadStatusSchema>;
export type TranslationStatus = z.infer<typeof translationStatusSchema>;
export type AudioGenerationStatus = z.infer<typeof audioGenerationStatusSchema>;

// Supported languages enum
export const languageSchema = z.enum([
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi'
]);
export type Language = z.infer<typeof languageSchema>;

// Video schema
export const videoSchema = z.object({
  id: z.number(),
  filename: z.string(),
  original_filename: z.string(),
  file_path: z.string(),
  file_size: z.number().int(),
  duration: z.number().nullable(), // Duration in seconds
  format: z.string(), // Video format (mp4, avi, etc.)
  upload_status: uploadStatusSchema,
  uploaded_at: z.coerce.date(),
  created_at: z.coerce.date()
});

export type Video = z.infer<typeof videoSchema>;

// Translation job schema
export const translationJobSchema = z.object({
  id: z.number(),
  video_id: z.number(),
  source_language: languageSchema,
  target_language: languageSchema,
  status: translationStatusSchema,
  original_audio_path: z.string().nullable(),
  translated_text: z.string().nullable(),
  error_message: z.string().nullable(),
  started_at: z.coerce.date().nullable(),
  completed_at: z.coerce.date().nullable(),
  created_at: z.coerce.date()
});

export type TranslationJob = z.infer<typeof translationJobSchema>;

// Audio generation job schema
export const audioGenerationJobSchema = z.object({
  id: z.number(),
  translation_job_id: z.number(),
  status: audioGenerationStatusSchema,
  generated_audio_path: z.string().nullable(),
  voice_cloned: z.boolean(),
  error_message: z.string().nullable(),
  started_at: z.coerce.date().nullable(),
  completed_at: z.coerce.date().nullable(),
  created_at: z.coerce.date()
});

export type AudioGenerationJob = z.infer<typeof audioGenerationJobSchema>;

// Final output schema
export const finalOutputSchema = z.object({
  id: z.number(),
  video_id: z.number(),
  translation_job_id: z.number(),
  audio_generation_job_id: z.number(),
  final_video_path: z.string(),
  created_at: z.coerce.date()
});

export type FinalOutput = z.infer<typeof finalOutputSchema>;

// Input schemas for creating records
export const createVideoInputSchema = z.object({
  filename: z.string(),
  original_filename: z.string(),
  file_path: z.string(),
  file_size: z.number().int().positive(),
  duration: z.number().positive().nullable(),
  format: z.string()
});

export type CreateVideoInput = z.infer<typeof createVideoInputSchema>;

export const createTranslationJobInputSchema = z.object({
  video_id: z.number(),
  source_language: languageSchema,
  target_language: languageSchema
});

export type CreateTranslationJobInput = z.infer<typeof createTranslationJobInputSchema>;

export const createAudioGenerationJobInputSchema = z.object({
  translation_job_id: z.number(),
  voice_cloned: z.boolean().default(true)
});

export type CreateAudioGenerationJobInput = z.infer<typeof createAudioGenerationJobInputSchema>;

// Update schemas
export const updateVideoStatusInputSchema = z.object({
  id: z.number(),
  upload_status: uploadStatusSchema,
  duration: z.number().positive().optional(),
  format: z.string().optional()
});

export type UpdateVideoStatusInput = z.infer<typeof updateVideoStatusInputSchema>;

export const updateTranslationJobInputSchema = z.object({
  id: z.number(),
  status: translationStatusSchema.optional(),
  original_audio_path: z.string().nullable().optional(),
  translated_text: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  started_at: z.coerce.date().nullable().optional(),
  completed_at: z.coerce.date().nullable().optional()
});

export type UpdateTranslationJobInput = z.infer<typeof updateTranslationJobInputSchema>;

export const updateAudioGenerationJobInputSchema = z.object({
  id: z.number(),
  status: audioGenerationStatusSchema.optional(),
  generated_audio_path: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  started_at: z.coerce.date().nullable().optional(),
  completed_at: z.coerce.date().nullable().optional()
});

export type UpdateAudioGenerationJobInput = z.infer<typeof updateAudioGenerationJobInputSchema>;

export const createFinalOutputInputSchema = z.object({
  video_id: z.number(),
  translation_job_id: z.number(),
  audio_generation_job_id: z.number(),
  final_video_path: z.string()
});

export type CreateFinalOutputInput = z.infer<typeof createFinalOutputInputSchema>;

// Query schemas for filtering and pagination
export const getVideosQuerySchema = z.object({
  status: uploadStatusSchema.optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0)
});

export type GetVideosQuery = z.infer<typeof getVideosQuerySchema>;

export const getTranslationJobsQuerySchema = z.object({
  video_id: z.number().optional(),
  status: translationStatusSchema.optional(),
  limit: z.number().int().positive().default(10),
  offset: z.number().int().nonnegative().default(0)
});

export type GetTranslationJobsQuery = z.infer<typeof getTranslationJobsQuerySchema>;