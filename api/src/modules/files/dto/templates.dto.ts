import { DocumentScope, FolderTemplateTarget } from 'generated/prisma';
import { z } from 'zod';
import { BaseListQuerySchema, boolish } from '@/shared/utils/pagination/pagination.utils';

const FOLDER_NAME = /^[^\\/:*?"<>|]+$/;

/** One node of a folder template tree (17 §7). */
export interface FolderTemplateNode {
    name: string;
    customer_visible?: boolean;
    children?: FolderTemplateNode[];
}

export const FolderTemplateNodeSchema: z.ZodType<FolderTemplateNode> = z.lazy(() =>
    z.object({
        name: z.string().trim().min(1).max(120).regex(FOLDER_NAME, 'Folder names cannot contain \\ / : * ? " < > |'),
        customer_visible: z.boolean().optional(),
        children: z.array(FolderTemplateNodeSchema).max(50).optional(),
    }),
);

export const CreateFolderTemplateSchema = z.object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(1000).nullish(),
    target: z.nativeEnum(FolderTemplateTarget).default(FolderTemplateTarget.ORGANIZATION),
    project_type_id: z.string().uuid().nullish(),
    structure: z.array(FolderTemplateNodeSchema).min(1).max(50),
    is_default: z.boolean().optional(),
});
export type CreateFolderTemplateInput = z.infer<typeof CreateFolderTemplateSchema>;
export const UpdateFolderTemplateSchema = CreateFolderTemplateSchema.partial();
export type UpdateFolderTemplateInput = z.infer<typeof UpdateFolderTemplateSchema>;

export const ApplyFolderTemplateSchema = z.object({
    /** Folder the new tree is created in; omit for the top level. */
    parent_folder_id: z.string().uuid().optional(),
    /** Name of the root folder that holds the template's folders; omit to create the template's folders directly in the parent. */
    root_name: z.string().trim().min(1).max(120).regex(FOLDER_NAME).optional(),
    project_id: z.string().uuid().optional(),
    company_id: z.string().uuid().optional(),
});
export type ApplyFolderTemplateInput = z.infer<typeof ApplyFolderTemplateSchema>;

export const TemplateQuerySchema = BaseListQuerySchema.extend({ archived: boolish });
export type TemplateQuery = z.infer<typeof TemplateQuerySchema>;

/** Placeholder of a document template: `{{key}}` in the body. */
export const TemplateVariableSchema = z.object({
    key: z.string().regex(/^[a-zA-Z][\w.]{0,59}$/, 'Keys use letters, digits, _ and .'),
    label: z.string().max(120).optional(),
    required: z.boolean().optional(),
    default: z.string().max(2000).optional(),
});
export type TemplateVariable = z.infer<typeof TemplateVariableSchema>;

export const CreateDocumentTemplateSchema = z.object({
    /** Existing text document (Markdown, plain text, HTML, CSV, JSON) whose current version becomes the template body. */
    document_id: z.string().uuid(),
    name: z.string().trim().min(1).max(160),
    description: z.string().max(1000).nullish(),
    category_id: z.string().uuid().nullish(),
    folder_id: z.string().uuid().nullish(),
    scope: z.nativeEnum(DocumentScope).optional(),
    /** Omit to detect the {{placeholders}} in the body. */
    variables: z.array(TemplateVariableSchema).max(100).optional(),
});
export type CreateDocumentTemplateInput = z.infer<typeof CreateDocumentTemplateSchema>;
export const UpdateDocumentTemplateSchema = CreateDocumentTemplateSchema.omit({ document_id: true }).partial().extend({
    /** Point the template at the current version of this document (e.g. after editing the body). */
    document_id: z.string().uuid().optional(),
});
export type UpdateDocumentTemplateInput = z.infer<typeof UpdateDocumentTemplateSchema>;

export const GenerateDocumentSchema = z.object({
    values: z.record(z.string(), z.string().max(20_000)).default({}),
    title: z.string().trim().min(1).max(255).optional(),
    folder_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    company_id: z.string().uuid().optional(),
});
export type GenerateDocumentInput = z.infer<typeof GenerateDocumentSchema>;
