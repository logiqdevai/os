import { Archive, CheckCheck, Clock, FolderOpen, KeyRound, Link, Trash2 } from "lucide-react";
import type { AppDefinition } from "../app.types";

export const filesApp: AppDefinition = {
    id: "files",
    label: "Files",
    icon: Archive,
    basePath: "/files",
    module: "DOCUMENTS",
    viewPermissions: ["documents.documents.read"],
    newAction: { label: "Upload", to: "/files/upload", permission: "documents.documents.create" },
    nav: [
        { items: [
            { label: "Browse", to: "/files", icon: FolderOpen, end: true },
            { label: "Recent & favorites", to: "/files/recent", icon: Clock },
            { label: "Shared", to: "/files/shared", icon: Link },
        ] },
        { label: "Workflow", items: [
            { label: "Approvals", to: "/files/approvals", icon: CheckCheck },
        ] },
        { label: "Vault", items: [
            { label: "Credentials", to: "/files/vault", icon: KeyRound, permissions: ["documents.vault.read"] },
        ] },
        { items: [
            { label: "Trash", to: "/files/trash", icon: Trash2 },
        ] },
    ],
};
