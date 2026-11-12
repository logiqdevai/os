import { z } from 'zod';

/** 15 §6 — question for AI Q&A (REST body and MCP tool input). */
export const AskDocsSchema = z.object({
    question: z.string().trim().min(3).max(1000),
    space_id: z.string().uuid().optional(),
});
export type AskDocsInput = z.infer<typeof AskDocsSchema>;

/** 15 §2 — Markdown export of one page, a page with its sub-pages, or a whole space. */
export const ExportDocsSchema = z
    .object({
        scope: z.enum(['PAGE', 'SUBTREE', 'SPACE']).default('SUBTREE'),
        page_id: z.string().uuid().optional(),
        space_id: z.string().uuid().optional(),
    })
    .refine((v) => (v.scope === 'SPACE' ? !!v.space_id : !!v.page_id), { message: 'SPACE exports need space_id; PAGE / SUBTREE exports need page_id' });
export type ExportDocsInput = z.infer<typeof ExportDocsSchema>;

/** Multipart fields of POST /docs/import (the file is the "file" part). */
export const ImportDocsSchema = z.object({
    space_id: z.string().uuid(),
    parent_page_id: z.preprocess((v) => (v === '' ? undefined : v), z.string().uuid().optional()),
    publish: z.preprocess((v) => v === true || v === 'true', z.boolean()).optional(),
});
export type ImportDocsInput = z.infer<typeof ImportDocsSchema>;
