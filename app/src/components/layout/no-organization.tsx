import { useState } from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { useLogout } from "@/features/session/hooks/use-session";
import { CreateOrganizationDialog } from "./create-organization-dialog";

/** Shown when the signed-in user has no active membership. */
export function NoOrganization() {
    const [open, setOpen] = useState(false);
    const logout = useLogout();
    return (
        <div className="grid h-dvh place-items-center bg-background p-4">
            <EmptyState
                icon={Building2}
                title="You're not part of an organization yet"
                description="Create your agency's workspace, or ask an administrator to invite you."
                action={
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => logout.mutate()}>Sign out</Button>
                        <Button onClick={() => setOpen(true)}>Create organization</Button>
                    </div>
                }
            />
            <CreateOrganizationDialog open={open} onOpenChange={setOpen} />
        </div>
    );
}
