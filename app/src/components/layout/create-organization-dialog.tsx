import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateOrganization } from "@/features/session/hooks/use-session";
import { createOrganizationSchema, type CreateOrganizationFormValues } from "@/features/session/validation-schemas/session.schema";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";

export function CreateOrganizationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const create = useCreateOrganization();
    const navigate = useNavigate();
    const form = useForm<CreateOrganizationFormValues>({ resolver: zodResolver(createOrganizationSchema), defaultValues: { name: "" } });

    const submit = form.handleSubmit((values) =>
        create.mutate(values.name, {
            onSuccess: () => {
                onOpenChange(false);
                form.reset();
                toast({ title: "Organization created" });
                navigate("/home");
            },
            onError: (e) => toast({ variant: "destructive", title: "Could not create organization", description: getApiErrorMessage(e) }),
        })
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={submit} className="space-y-4">
                    <DialogHeader>
                        <DialogTitle>New organization</DialogTitle>
                        <DialogDescription>You become its owner. Data is fully separate from your other organizations.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5">
                        <Label htmlFor="org-name">Organization name</Label>
                        <Input id="org-name" autoFocus {...form.register("name")} placeholder="Acme Studio" />
                        {form.formState.errors.name && <p className="text-xs text-danger">{form.formState.errors.name.message}</p>}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" loading={create.isPending}>Create</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
