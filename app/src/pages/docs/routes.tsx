import { Route, Routes } from "react-router-dom";
import { Construction } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { EmptyState } from "@/components/ui/states";

function Placeholder() {
    return (
        <Page>
            <PageHeader title="Docs" />
            <EmptyState icon={Construction} title="This area is being built" description="Check back soon." />
        </Page>
    );
}

export default function DocsRoutes() {
    return (
        <Routes>
            <Route path="*" element={<Placeholder />} />
        </Routes>
    );
}
