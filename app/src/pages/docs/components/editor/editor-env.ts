import { createContext, useContext } from "react";

export interface MentionCandidate {
    kind: "member" | "page";
    id: string;
    label: string;
    hint?: string;
    icon?: string | null;
}

/** What the editor needs from the page around it (node views and menus read it through context). */
export interface EditorEnv {
    /** Page the editor belongs to (images upload into it). Absent while a page is not created yet. */
    pageId?: string;
    editable: boolean;
    /** Signed URL of an `attachment:<document_id>` file (or the src itself for http(s) URLs). */
    resolveAttachment: (src: string) => Promise<string | null>;
    /** Upload a file (image, video, audio, any file); returns the Markdown src (`attachment:<id>`). */
    uploadFile?: (file: File) => Promise<string>;
    /** Open a linked page (chip click). */
    openPage: (ref: { id: string | null; title: string }) => void;
    /** People and pages for "@" and "Link to page". */
    searchMentions: (query: string) => Promise<MentionCandidate[]>;
    /** "/page": create a sub-page and return it (the editor inserts a link and the page opens it). */
    createSubpage?: () => Promise<{ id: string; title: string }>;
    /** "/emoji": open the emoji picker at the caret (provided by the editor itself, not the page). */
    pickEmoji?: (onPick: (emoji: string) => void) => void;
}

export const EditorEnvContext = createContext<EditorEnv | null>(null);

export function useEditorEnv(): EditorEnv {
    const env = useContext(EditorEnvContext);
    if (!env) throw new Error("useEditorEnv must be used inside <EditorEnvContext.Provider>");
    return env;
}
