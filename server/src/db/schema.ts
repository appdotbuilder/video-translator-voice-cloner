import { serial, text, pgTable, timestamp, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Define enums for status tracking
export const uploadStatusEnum = pgEnum('upload_status', ['pending', 'uploaded', 'processing', 'failed']);
export const translationStatusEnum = pgEnum('translation_status', ['pending', 'extracting_audio', 'translating', 'completed', 'failed']);
export const audioGenerationStatusEnum = pgEnum('audio_generation_status', ['pending', 'generating', 'completed', 'failed']);

// Define supported languages enum
export const languageEnum = pgEnum('language', [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi'
]);

// Videos table - stores uploaded video files
export const videosTable = pgTable('videos', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(), // Generated filename for storage
  original_filename: text('original_filename').notNull(), // User's original filename
  file_path: text('file_path').notNull(), // Path to stored video file
  file_size: integer('file_size').notNull(), // File size in bytes
  duration: integer('duration'), // Duration in seconds, nullable until processed
  format: text('format').notNull(), // Video format (mp4, avi, etc.)
  upload_status: uploadStatusEnum('upload_status').notNull().default('pending'),
  uploaded_at: timestamp('uploaded_at').defaultNow().notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Translation jobs table - tracks video translation processes
export const translationJobsTable = pgTable('translation_jobs', {
  id: serial('id').primaryKey(),
  video_id: integer('video_id').notNull().references(() => videosTable.id, { onDelete: 'cascade' }),
  source_language: languageEnum('source_language').notNull(),
  target_language: languageEnum('target_language').notNull(),
  status: translationStatusEnum('status').notNull().default('pending'),
  original_audio_path: text('original_audio_path'), // Path to extracted audio file
  translated_text: text('translated_text'), // Translated text content
  error_message: text('error_message'), // Error message if translation fails
  started_at: timestamp('started_at'),
  completed_at: timestamp('completed_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Audio generation jobs table - tracks voice cloning and audio generation
export const audioGenerationJobsTable = pgTable('audio_generation_jobs', {
  id: serial('id').primaryKey(),
  translation_job_id: integer('translation_job_id').notNull().references(() => translationJobsTable.id, { onDelete: 'cascade' }),
  status: audioGenerationStatusEnum('status').notNull().default('pending'),
  generated_audio_path: text('generated_audio_path'), // Path to generated audio file
  voice_cloned: boolean('voice_cloned').notNull().default(true), // Whether voice cloning was used
  error_message: text('error_message'), // Error message if generation fails
  started_at: timestamp('started_at'),
  completed_at: timestamp('completed_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Final outputs table - stores completed video translations
export const finalOutputsTable = pgTable('final_outputs', {
  id: serial('id').primaryKey(),
  video_id: integer('video_id').notNull().references(() => videosTable.id, { onDelete: 'cascade' }),
  translation_job_id: integer('translation_job_id').notNull().references(() => translationJobsTable.id, { onDelete: 'cascade' }),
  audio_generation_job_id: integer('audio_generation_job_id').notNull().references(() => audioGenerationJobsTable.id, { onDelete: 'cascade' }),
  final_video_path: text('final_video_path').notNull(), // Path to final translated video
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Define relations between tables
export const videosRelations = relations(videosTable, ({ many }) => ({
  translationJobs: many(translationJobsTable),
  finalOutputs: many(finalOutputsTable),
}));

export const translationJobsRelations = relations(translationJobsTable, ({ one, many }) => ({
  video: one(videosTable, {
    fields: [translationJobsTable.video_id],
    references: [videosTable.id],
  }),
  audioGenerationJobs: many(audioGenerationJobsTable),
  finalOutputs: many(finalOutputsTable),
}));

export const audioGenerationJobsRelations = relations(audioGenerationJobsTable, ({ one, many }) => ({
  translationJob: one(translationJobsTable, {
    fields: [audioGenerationJobsTable.translation_job_id],
    references: [translationJobsTable.id],
  }),
  finalOutputs: many(finalOutputsTable),
}));

export const finalOutputsRelations = relations(finalOutputsTable, ({ one }) => ({
  video: one(videosTable, {
    fields: [finalOutputsTable.video_id],
    references: [videosTable.id],
  }),
  translationJob: one(translationJobsTable, {
    fields: [finalOutputsTable.translation_job_id],
    references: [translationJobsTable.id],
  }),
  audioGenerationJob: one(audioGenerationJobsTable, {
    fields: [finalOutputsTable.audio_generation_job_id],
    references: [audioGenerationJobsTable.id],
  }),
}));

// TypeScript types for the table schemas
export type Video = typeof videosTable.$inferSelect;
export type NewVideo = typeof videosTable.$inferInsert;

export type TranslationJob = typeof translationJobsTable.$inferSelect;
export type NewTranslationJob = typeof translationJobsTable.$inferInsert;

export type AudioGenerationJob = typeof audioGenerationJobsTable.$inferSelect;
export type NewAudioGenerationJob = typeof audioGenerationJobsTable.$inferInsert;

export type FinalOutput = typeof finalOutputsTable.$inferSelect;
export type NewFinalOutput = typeof finalOutputsTable.$inferInsert;

// Export all tables for proper query building
export const tables = {
  videos: videosTable,
  translationJobs: translationJobsTable,
  audioGenerationJobs: audioGenerationJobsTable,
  finalOutputs: finalOutputsTable,
};