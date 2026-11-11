import { Route, Routes } from "react-router-dom";
import { Construction } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { EmptyState } from "@/components/ui/states";

function Placeholder() {
    return (
        <Page>
            <PageHeader title="Time" />
            <EmptyState icon={Construction} title="This area is being built" description="Check back soon." />
        </Page>
    );
}

export default function TimeRoutes() {
    return (
        <Routes>
            <Route path="*" element={<Placeholder />} />
        </Routes>
    );
}
