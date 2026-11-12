import { useSearchParams } from "react-router-dom";
import { Page, PageHeader } from "@/components/ui/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NoAccessState } from "@/components/ui/states";
import { usePermissions } from "@/hooks/use-permission";
import { DocumentTemplatesTab } from "./components/document-templates-tab";
import { FolderTemplatesTab } from "./components/folder-templates-tab";

/**
 * /files/templates?tab=documents|folders — document templates and folder templates (17 §4, §7).
 * @perm documents tab documents.templates.read · folders tab documents.documents.read (manage: documents.folders.manage)
 */
export default function FileTemplatesPage() {
    const p = usePermissions();
    const [sp, setSp] = useSearchParams();
    const canDocs = p.can("documents.templates.read");
    const tab = sp.get("tab") ?? (canDocs ? "documents" : "folders");
    if (!p.can("documents.documents.read")) return <Page><NoAccessState /></Page>;

    return (
        <Page>
            <PageHeader title="Templates" description="Generate documents from templates with fields, and create the same folder structure for every project or client." />
            <Tabs value={tab} onValueChange={(v) => setSp(() => new URLSearchParams({ tab: v }), { replace: true })}>
                <TabsList className="mb-4">
                    {canDocs && <TabsTrigger value="documents">Document templates</TabsTrigger>}
                    <TabsTrigger value="folders">Folder templates</TabsTrigger>
                </TabsList>
                {canDocs && <TabsContent value="documents"><DocumentTemplatesTab /></TabsContent>}
                <TabsContent value="folders"><FolderTemplatesTab /></TabsContent>
            </Tabs>
        </Page>
    );
}
