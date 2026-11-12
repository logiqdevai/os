import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Info, Save, ShieldAlert } from "lucide-react";
import { Page, PageHeader, Section } from "@/components/ui/page";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ConfirmationDialog from "@/components/ui/confirmation-dialog";
import { useSecurityPolicy, useUpdateSecurityPolicy } from "@/features/admin/security/hooks/use-security-policy";
import type { SecurityPolicy, UpdateSecurityPolicyDto } from "@/features/admin/security/interfaces/security.interfaces";
import {
    IdleTimeoutOptions,
    InvitationPolicyFormOptions,
    MfaPolicyFormOptions,
    PasswordMaxAgeOptions,
    PortalMfaPolicyFormOptions,
    SessionDurationOptions,
} from "@/config/constants/dropdowns/admin/security-form.options";
import type { DropdownOption } from "@/lib/dropdown-option-label.utils";
import { formatDateTime, formatMinutes } from "@/lib/format";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { TagListInput } from "../../components/tag-list-input";

type Draft = Omit<SecurityPolicy, "organization_id" | "updated_at" | "is_default" | "context">;
const FIELDS: (keyof Draft)[] = [
    "mfa_policy", "portal_mfa_policy", "password_min_length", "password_require_symbols", "password_max_age_days", "session_duration_minutes", "idle_timeout_minutes",
    "allowed_email_domains", "restrict_invitations_to_domains", "allowed_ip_ranges", "allowed_countries", "invitation_policy", "members_can_view_sessions", "sso_required",
];
const toDraft = (p: SecurityPolicy): Draft => Object.fromEntries(FIELDS.map((k) => [k, p[k]])) as Draft;

const DOMAIN = /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}(\/([0-9]|[12]\d|3[0-2]))?$/;

/** Options with the current value appended when it is not one of the presets (set through the API or MCP). */
const withCurrent = (options: DropdownOption<string>[], value: number | null, label: (n: number) => string) =>
    value === null || options.some((o) => o.id === String(value)) ? options : [...options, { id: String(value), label: label(value) }];

function SettingRow({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
    return (
        <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0">
                <div className="text-[13px] font-medium text-foreground">{title}</div>
                {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
            </div>
            <div className="w-full flex-none sm:w-64">{children}</div>
        </div>
    );
}

function Card({ children }: { children: ReactNode }) {
    return <div className="divide-y divide-border-soft rounded-lg border border-border bg-card">{children}</div>;
}

function Pick({ value, options, onChange, label }: { value: string; options: DropdownOption<string>[]; onChange: (v: string) => void; label: string }) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
            <SelectContent>{options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
    );
}

/**
 * Sign-in & security — /admin/security   (mockup 01-admin `security`, spec §72–74)
 * @perm VIEW + save organizations.security.manage (manage-only screen)
 * @api GET /security-policy · PATCH /security-policy {changed fields}
 * @states loading · error · saving · no-access · risky-change confirmation
 */
export default function SecurityPolicyPage() {
    const policy = useSecurityPolicy();
    const update = useUpdateSecurityPolicy();
    const [draft, setDraft] = useState<Draft | null>(null);
    const [confirming, setConfirming] = useState(false);

    useEffect(() => {
        if (policy.data) setDraft(toDraft(policy.data));
    }, [policy.data]);

    const changes = useMemo<UpdateSecurityPolicyDto>(() => {
        if (!policy.data || !draft) return {};
        const base = toDraft(policy.data);
        return Object.fromEntries(FIELDS.filter((k) => JSON.stringify(base[k]) !== JSON.stringify(draft[k])).map((k) => [k, draft[k]])) as UpdateSecurityPolicyDto;
    }, [policy.data, draft]);
    const dirty = Object.keys(changes).length > 0;

    if (policy.isPending) return <PageSkeleton />;
    if (policy.error || !policy.data) return <Page><PageHeader title="Sign-in & security" /><ErrorState error={policy.error} onRetry={() => policy.refetch()} /></Page>;
    if (!draft) return <PageSkeleton />;

    const ctx = policy.data.context;
    const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));

    const risky: string[] = [];
    if (changes.mfa_policy && changes.mfa_policy !== "OPTIONAL") risky.push("Members without MFA will have to set it up before they can work, including you if you have not.");
    if (changes.allowed_ip_ranges && draft.allowed_ip_ranges.length) risky.push("Sign-in from any address outside the allowed ranges is blocked.");
    if (changes.session_duration_minutes && changes.session_duration_minutes < policy.data.session_duration_minutes) risky.push("New sessions will expire sooner; existing sessions keep their current expiry.");
    if (changes.idle_timeout_minutes) risky.push(`Sessions idle for more than ${formatMinutes(changes.idle_timeout_minutes)} are signed out, including sessions open right now.`);
    if (changes.sso_required) risky.push("Members must sign in with your identity provider.");
    if (changes.password_min_length && changes.password_min_length > policy.data.password_min_length) risky.push("New passwords must follow the longer minimum; existing passwords keep working.");

    const save = () =>
        update.mutate(changes, {
            onSuccess: () => { toast({ title: "Security policy saved" }); setConfirming(false); },
            onError: (e) => { toast({ variant: "destructive", title: "Could not save", description: getApiErrorMessage(e) }); setConfirming(false); },
        });

    const ssoReady = ctx.sso_enabled && ctx.verified_domains > 0;

    return (
        <Page width="narrow">
            <PageHeader
                title="Sign-in & security"
                description="Password rules, MFA, session lifetime and access restrictions for everyone in the organization."
                meta={policy.data.is_default ? <Badge variant="neutral">Defaults</Badge> : undefined}
                actions={
                    <>
                        <Button variant="ghost" disabled={!dirty || update.isPending} onClick={() => setDraft(toDraft(policy.data!))}>Discard</Button>
                        <Button disabled={!dirty} loading={update.isPending} onClick={() => (risky.length ? setConfirming(true) : save())}><Save /> Save changes</Button>
                    </>
                }
            />
            <div className="space-y-6">
                <Section title="Multi-factor authentication">
                    <Card>
                        <SettingRow title="MFA policy" hint="Who must use a second factor when signing in.">
                            <Pick label="MFA policy" value={draft.mfa_policy} options={MfaPolicyFormOptions} onChange={(v) => set("mfa_policy", v as Draft["mfa_policy"])} />
                        </SettingRow>
                        <SettingRow title="Customer portal MFA" hint="Portal users may follow a lighter policy.">
                            <Pick label="Customer portal MFA" value={draft.portal_mfa_policy} options={PortalMfaPolicyFormOptions} onChange={(v) => set("portal_mfa_policy", v as Draft["portal_mfa_policy"])} />
                        </SettingRow>
                        <div className="flex gap-2 px-4 py-3 text-xs text-muted-foreground">
                            <Info className="mt-0.5 size-3.5 flex-none" />
                            <span>Members who must use MFA and have not set it up are sent to set it up right after sign-in and cannot use anything else until they do. “Admins” are members who can manage security, settings, roles, permissions or members; “sensitive modules” means anyone holding a sensitive permission. Members set it up in Settings → Security; you can reset a member’s MFA from their profile.</span>
                        </div>
                    </Card>
                </Section>

                <Section title="Passwords">
                    <Card>
                        <SettingRow title="Minimum length" hint="Applies when a password is set, changed or reset.">
                            <Input type="number" min={8} max={128} aria-label="Minimum password length" value={draft.password_min_length} onChange={(e) => set("password_min_length", Math.max(0, Number(e.target.value) || 0))} />
                        </SettingRow>
                        <SettingRow title="Require a symbol" hint="At least one character that is not a letter or digit.">
                            <Switch aria-label="Require a symbol" checked={draft.password_require_symbols} onCheckedChange={(v) => set("password_require_symbols", v)} />
                        </SettingRow>
                        <SettingRow title="Password max age" hint="After this, members are asked to choose a new password at sign-in.">
                            <Pick label="Password max age" value={draft.password_max_age_days === null ? "none" : String(draft.password_max_age_days)} options={withCurrent(PasswordMaxAgeOptions, draft.password_max_age_days, (n) => `${n} days`)} onChange={(v) => set("password_max_age_days", v === "none" ? null : Number(v))} />
                        </SettingRow>
                    </Card>
                </Section>

                <Section title="Sessions">
                    <Card>
                        <SettingRow title="Session duration" hint="How long a sign-in lasts. Applies to new sessions.">
                            <Pick label="Session duration" value={String(draft.session_duration_minutes)} options={withCurrent(SessionDurationOptions, draft.session_duration_minutes, formatMinutes)} onChange={(v) => set("session_duration_minutes", Number(v))} />
                        </SettingRow>
                        <SettingRow title="Idle timeout" hint="Sign out a session after this long without activity. Background refreshes do not count as activity.">
                            <Pick label="Idle timeout" value={draft.idle_timeout_minutes === null ? "none" : String(draft.idle_timeout_minutes)} options={withCurrent(IdleTimeoutOptions, draft.idle_timeout_minutes, formatMinutes)} onChange={(v) => set("idle_timeout_minutes", v === "none" ? null : Number(v))} />
                        </SettingRow>
                        <SettingRow title="Members can see and end their own sessions" hint={<>Admins always can, in <Link className="underline" to="/admin/sessions">Sessions</Link>.</>}>
                            <Switch aria-label="Members can see their own sessions" checked={draft.members_can_view_sessions} onCheckedChange={(v) => set("members_can_view_sessions", v)} />
                        </SettingRow>
                    </Card>
                </Section>

                <Section title="Access restrictions">
                    <Card>
                        <div className="space-y-2 px-4 py-3">
                            <div>
                                <div className="text-[13px] font-medium text-foreground">Allowed IP ranges</div>
                                <div className="text-xs text-muted-foreground">IPv4 addresses or CIDR ranges. Empty = sign-in from anywhere. {ctx.caller_ip && <>Your address: <code className="font-mono">{ctx.caller_ip}</code></>}</div>
                            </div>
                            <TagListInput aria-label="Allowed IP ranges" value={draft.allowed_ip_ranges} placeholder="203.0.113.0/24" validate={(v) => (IPV4.test(v) ? null : "Enter an IPv4 address or CIDR range")} onChange={(v) => set("allowed_ip_ranges", v)} />
                        </div>
                        <div className="space-y-2 px-4 py-3">
                            <div>
                                <div className="text-[13px] font-medium text-foreground">Allowed email domains</div>
                                <div className="text-xs text-muted-foreground">Domains your members' emails may use.</div>
                            </div>
                            <TagListInput aria-label="Allowed email domains" value={draft.allowed_email_domains} placeholder="agency.com" normalize={(s) => s.trim().toLowerCase().replace(/^@/, "")} validate={(v) => (DOMAIN.test(v) ? null : "Enter a domain like agency.com")} onChange={(v) => set("allowed_email_domains", v)} />
                        </div>
                        <SettingRow title="Only invite people from these domains" hint={draft.allowed_email_domains.length ? undefined : "Add an allowed domain first."}>
                            <Switch aria-label="Restrict invitations to allowed domains" disabled={!draft.allowed_email_domains.length} checked={draft.restrict_invitations_to_domains} onCheckedChange={(v) => set("restrict_invitations_to_domains", v)} />
                        </SettingRow>
                        <SettingRow title="Who can invite">
                            <Pick label="Who can invite" value={draft.invitation_policy} options={InvitationPolicyFormOptions} onChange={(v) => set("invitation_policy", v as Draft["invitation_policy"])} />
                        </SettingRow>
                        <div className="space-y-2 px-4 py-3">
                            <div>
                                <div className="text-[13px] font-medium text-foreground">Allowed sign-in countries</div>
                                <div className="text-xs text-muted-foreground">Two-letter codes, e.g. GR, CY. Empty = anywhere. Saved now; enforced once location lookup is enabled.</div>
                            </div>
                            <TagListInput aria-label="Allowed countries" value={draft.allowed_countries} placeholder="GR" normalize={(s) => s.trim().toUpperCase()} validate={(v) => (/^[A-Z]{2}$/.test(v) ? null : "Use a two-letter country code")} onChange={(v) => set("allowed_countries", v)} />
                        </div>
                        <SettingRow title="Require SSO" hint={ssoReady ? "Members must sign in with your identity provider." : <>Needs an enabled identity provider and a verified domain (<Link className="underline" to="/admin/sso">SSO</Link>).</>}>
                            <Switch aria-label="Require SSO" disabled={!ssoReady && !draft.sso_required} checked={draft.sso_required} onCheckedChange={(v) => set("sso_required", v)} />
                        </SettingRow>
                    </Card>
                </Section>

                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldAlert className="size-3.5" />
                    Every change is written to the audit log.{policy.data.updated_at && <>Last saved {formatDateTime(policy.data.updated_at)}.</>}
                </p>
            </div>

            <ConfirmationDialog
                isOpen={confirming}
                onClose={() => setConfirming(false)}
                title="Apply these security changes?"
                description={risky.join(" ")}
                confirmText="Apply changes"
                variant="destructive"
                isLoading={update.isPending}
                onConfirm={save}
            />
        </Page>
    );
}
