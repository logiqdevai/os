import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCreateDomain, useVerifyDomain } from "@/features/admin/domains/hooks/use-domains";
import type { OrganizationDomain } from "@/features/admin/domains/interfaces/domains.interfaces";
import { DomainCheckErrorOptions } from "@/config/constants/dropdowns/admin/domain-form.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatRelative } from "@/lib/format";
import { CopyField } from "../../../components/copy-field";

interface DomainDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Existing domain: show its DNS record and the check. Omit to add a new domain. */
    domain?: OrganizationDomain | null;
}

/** Add a domain (step 1) → publish the TXT record and check DNS (step 2). Mockup 01-admin `domainNew`. */
export function DomainDialog({ open, onOpenChange, domain }: DomainDialogProps) {
    const create = useCreateDomain();
    const verify = useVerifyDomain();
    const [name, setName] = useState("");
    const [discovery, setDiscovery] = useState(false);
    const [current, setCurrent] = useState<OrganizationDomain | null>(null);

    useEffect(() => {
        if (open) {
            setName("");
            setDiscovery(false);
            setCurrent(domain ?? null);
        }
    }, [open, domain]);

    const add = () =>
        create.mutate(
            { domain: name, allow_discovery: discovery },
            { onSuccess: (d) => setCurrent(d) }
        );

    const check = () =>
        current &&
        verify.mutate(current.id, {
            // The dialog shows the verified state (or what DNS returned) from `current`; no toast.
            onSuccess: (d) => setCurrent(d),
        });

    const txt = current?.dns_check?.txt;
    const verified = current?.status === "VERIFIED";

    return (
        <Dialog open={open} onOpenChange={(o) => !create.isPending && !verify.isPending && onOpenChange(o)}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{current ? current.domain : "Add domain"}</DialogTitle>
                    <DialogDescription>
                        {current ? "Prove you own the domain with a DNS TXT record. DNS changes can take up to 24 hours." : "Enter a domain your organization owns. Nothing changes for members until it is verified."}
                    </DialogDescription>
                </DialogHeader>

                {!current ? (
                    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); add(); }}>
                        <div className="space-y-1.5">
                            <Label htmlFor="domain-name">Domain</Label>
                            <Input id="domain-name" autoFocus placeholder="agency.com" value={name} onChange={(e) => setName(e.target.value)} />
                            <p className="text-xs text-muted-foreground">No protocol, no path. A domain can belong to one organization only.</p>
                        </div>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <Label htmlFor="domain-discovery">Allow discovery</Label>
                                <p className="text-xs text-muted-foreground">People with this email domain can find the organization and ask to join.</p>
                            </div>
                            <Switch id="domain-discovery" checked={discovery} onCheckedChange={setDiscovery} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>Cancel</Button>
                            <Button type="submit" disabled={!name.trim()} loading={create.isPending}>Continue</Button>
                        </DialogFooter>
                    </form>
                ) : (
                    <div className="space-y-4">
                        <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                            <div className="grid gap-2 sm:grid-cols-[80px_minmax(0,1fr)] sm:items-center">
                                <span className="text-xs text-muted-foreground">Type</span>
                                <span className="font-mono text-[12.5px]">TXT</span>
                                <span className="text-xs text-muted-foreground">Name</span>
                                <CopyField value={current.dns_record.name} label="record name" />
                                <span className="text-xs text-muted-foreground">Value</span>
                                <CopyField value={current.dns_record.value} label="record value" />
                            </div>
                        </div>
                        {verified ? (
                            <div className="flex items-start gap-2 rounded-md bg-success-soft p-3 text-[13px] text-success">
                                <CheckCircle2 className="mt-0.5 size-4 flex-none" /> Verified. You can keep or remove the TXT record; we check again only when you ask.
                            </div>
                        ) : txt && !txt.ok ? (
                            <div className="flex items-start gap-2 rounded-md bg-warning-soft p-3 text-[13px] text-warning">
                                <CircleAlert className="mt-0.5 size-4 flex-none" />
                                <span>
                                    {getDropdownOptionLabel(DomainCheckErrorOptions, txt.error ?? "record_not_found")}
                                    {current.last_checked_at && <> · checked {formatRelative(current.last_checked_at)}</>}
                                    {txt.found.length > 0 && <span className="mt-1 block break-all font-mono text-xs">Found: {txt.found.join(" · ")}</span>}
                                </span>
                            </div>
                        ) : null}
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={verify.isPending}>{verified ? "Done" : "Check later"}</Button>
                            {!verified && <Button onClick={check} loading={verify.isPending}><Zap /> Check DNS</Button>}
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
