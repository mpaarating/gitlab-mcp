/**
 * Zod schemas for runtime validation and type inference
 */

import { z } from "zod";

// Input schema for the gitlab_get_mr_comments tool
export const GitLabToolInputSchema = z
  .object({
    project: z.string().min(1, "Project is required"),
    mr: z
      .union([z.number().int().positive(), z.string().regex(/^\d+$/)])
      .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val)),
    includeSystem: z.boolean().default(false),
    includeOverviewNotes: z.boolean().default(true),
    onlyResolved: z.boolean().default(false),
    onlyUnresolved: z.boolean().default(false),
    perPage: z.number().int().min(1).max(100).default(100),
    format: z.enum(["json", "markdown"]).default("json"),
  })
  .refine((data) => !(data.onlyResolved && data.onlyUnresolved), {
    message: "Cannot set both onlyResolved and onlyUnresolved",
  });

export type GitLabToolInput = z.infer<typeof GitLabToolInputSchema>;

// Comment schema - normalized comment structure
export const CommentSchema = z.object({
  source: z.enum(["discussion", "note"]),
  thread_id: z.string().nullable(),
  note_id: z.number(),
  author: z
    .object({
      id: z.number(),
      username: z.string(),
      name: z.string(),
    })
    .nullable(),
  body: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullable(),
  system: z.boolean(),
  resolvable: z.boolean(),
  resolved: z.boolean().nullable(),
  resolved_by: z
    .object({
      id: z.number(),
      username: z.string(),
      name: z.string(),
    })
    .nullable(),
  position: z.record(z.any()).nullable(),
  file_path: z.string().nullable(),
});

export type Comment = z.infer<typeof CommentSchema>;

// Output schema for the tool response
export const GitLabToolOutputSchema = z.object({
  project: z.string(),
  mr: z.number(),
  fetchedAt: z.string().datetime(),
  counts: z.object({
    comments: z.number(),
    discussions: z.number(),
    notes: z.number(),
  }),
  comments: z.array(CommentSchema),
  markdown: z.string().optional(),
});

export type GitLabToolOutput = z.infer<typeof GitLabToolOutputSchema>;

// Filter options interface
export interface FilterOptions {
  includeSystem: boolean;
  onlyResolved: boolean;
  onlyUnresolved: boolean;
}
