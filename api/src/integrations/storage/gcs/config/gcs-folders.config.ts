export const GcsFolders = {
    documents: 'documents',
    avatars: 'avatars',
    uploads: 'uploads',
} as const;

export type GcsFolderKey = keyof typeof GcsFolders;
export type GcsFolderPath = (typeof GcsFolders)[GcsFolderKey];

export const DEFAULT_GCS_FOLDER = GcsFolders.documents;
