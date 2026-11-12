import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { usePortalProjects, useUploadPortalDocument } from "@/features/portal/hooks/use-portal";
import { usePortal } from "./portal-context";

const MAX_BYTES = 50 * 1024 * 1024;

/**
 * Share a file with the team (07 §9): stored by Files (17) in the company's customer-visible upload folder.
 * Drag and drop or pick a file; optional title and project. @perm portal.documents.upload · @api POST /portal/documents
 */
export function PortalUploadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
    const { can, feature } = usePortal();
    const showProjects = can("portal.projects.read") && feature("projects");
    const projects = usePortalProjects({ limit: 100 });
    const upload = useUploadPortalDocument();
    const inputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [title, setTitle] = useState("");
    const [projectId, setProjectId] = useState("none");
    const [progress, setProgress] = useState(0);
    const [dragging, setDragging] = useState(false);

    const reset = () => { setFile(null); setTitle(""); setProjectId("none"); setProgress(0); };
    const close = (o: boolean) => { if (upload.isPending) return; onOpenChange(o); if (!o) reset(); };
    const pick = (f: File | undefined | null) => {
        if (!f) return;
        if (f.size > MAX_BYTES) { toast({ variant: "destructive", title: "File too large", description: "Files can be up to 50 MB." }); return; }
        setFile(f);
    };
    const submit = () =>
        file &&
        upload.mutate(
            { file, title: title.trim() || undefined, project_id: projectId !== "none" ? projectId : undefined, onProgress: setProgress },
            { onSuccess: () => { toast({ title: "File shared with the team" }); close(false); }, onError: (e) => { setProgress(0); toast({ variant: "destructive", title: "Upload failed", description: getApiErrorMessage(e) }); } },
        );

    return (
        <Dialog open={open} onOpenChange={close}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Share a file</DialogTitle><DialogDescription>The team sees it in your shared folder. Up to 50 MB.</DialogDescription></DialogHeader>
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); }}
                    className={cn("flex w-full flex-col items-center gap-1 rounded-lg border border-dashed border-border px-4 py-6 text-center text-[13px] text-muted-foreground transition-colors hover:bg-secondary", dragging && "border-primary bg-secondary")}
                >
                    <Upload className="size-5" />
                    {file ? <span className="max-w-full truncate font-medium text-foreground">{file.name}</span> : <span>Drop a file here or <span className="font-medium text-foreground underline">browse</span></span>}
                </button>
                <input ref={inputRef} type="file" className="hidden" onChange={(e) => pick(e.target.files?.[0])} aria-label="Choose a file" />
                <div className="space-y-1.5">
                    <Label htmlFor="upload-title">Title (optional)</Label>
                    <Input id="upload-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={file?.name.replace(/\.[^.]+$/, "") ?? "Brand guidelines"} maxLength={255} />
                </div>
                {showProjects && !!projects.data?.data.length && (
                    <div className="space-y-1.5">
                        <Label>Project (optional)</Label>
                        <Select value={projectId} onValueChange={setProjectId}>
                            <SelectTrigger aria-label="Project"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No project</SelectItem>
                                {projects.data.data.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                {upload.isPending && <Progress value={progress} aria-label="Upload progress" />}
                <DialogFooter>
                    <Button variant="ghost" onClick={() => close(false)} disabled={upload.isPending}>Cancel</Button>
                    <Button onClick={submit} disabled={!file} loading={upload.isPending}>Upload</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
