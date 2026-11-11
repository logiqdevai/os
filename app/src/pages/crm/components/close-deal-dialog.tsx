import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dealLostSchema, dealWonSchema, type DealLostValues, type DealWonValues } from "@/features/crm/deals/validation-schemas/deals.schema";
import { useChangeDealStage } from "@/features/crm/deals/hooks/use-deals";
import { useCrmSettings } from "@/features/crm/settings/hooks/use-crm-settings";
import { toast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";

export interface CloseDealTarget {
    deal: { id: string; name: string };
    /** The pipeline's won or lost stage. */
    stage_id: string;
    mode: "won" | "lost";
}

/**
 * Close deal (mockup `deal-close`): Won with a note / Lost with a catalogue reason (02 §9).
 * Also opened when a card is dropped on the won/lost column.
 * @perm crm.deals.change_stage · @api POST /crm/deals/:id/stage
 */
export function CloseDealDialog({ target, onClose }: { target: CloseDealTarget | null; onClose: () => void }) {
    const change = useChangeDealStage();
    const settings = useCrmSettings(false, !!target);
    const reasons = settings.data?.loss_reasons.filter((r) => r.applies_to !== "LEAD") ?? [];
    const won = useForm<DealWonValues>({ resolver: zodResolver(dealWonSchema), defaultValues: { set_customer: true } });
    const lost = useForm<DealLostValues>({ resolver: zodResolver(dealLostSchema), defaultValues: { lost_reason_id: "" } });

    useEffect(() => {
        if (!target) return;
        won.reset({ won_note: "", actual_close_date: format(new Date(), "yyyy-MM-dd"), set_customer: true });
        lost.reset({ lost_reason_id: "", lost_reason: "", competitor: "" });
    }, [target, won, lost]);

    const done = (title: string) => ({
        onSuccess: () => { toast({ title }); onClose(); },
        onError: (e: unknown) => toast({ variant: "destructive" as const, title: "Could not close the deal", description: getApiErrorMessage(e) }),
    });

    const submitWon = won.handleSubmit((v) => target && change.mutate({ id: target.deal.id, stage_id: target.stage_id, won_note: v.won_note || undefined, actual_close_date: v.actual_close_date || undefined, set_customer: v.set_customer }, done("Deal won")));
    const submitLost = lost.handleSubmit((v) => target && change.mutate({ id: target.deal.id, stage_id: target.stage_id, lost_reason_id: v.lost_reason_id, lost_reason: v.lost_reason || undefined, competitor: v.competitor || undefined }, done("Deal marked lost")));

    return (
        <Dialog open={!!target} onOpenChange={(o) => !o && !change.isPending && onClose()}>
            <DialogContent className="sm:max-w-md">
                {target?.mode === "won" ? (
                    <Form {...won}>
                        <form onSubmit={submitWon} className="space-y-4">
                            <DialogHeader>
                                <DialogTitle>Mark “{target.deal.name}” won</DialogTitle>
                                <DialogDescription>The deal moves to the won stage with 100% probability.</DialogDescription>
                            </DialogHeader>
                            <FormField control={won.control} name="actual_close_date" render={({ field }) => (
                                <FormItem><FormLabel>Close date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={won.control} name="won_note" render={({ field }) => (
                                <FormItem><FormLabel>Why we won</FormLabel><FormControl><Textarea rows={3} placeholder="Strong references, fast timeline" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={won.control} name="set_customer" render={({ field }) => (
                                <FormItem className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                                    <div><FormLabel>Mark the company as a customer</FormLabel><FormDescription>Prospects become customers with a customer lifecycle stage.</FormDescription></div>
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Mark the company as a customer" /></FormControl>
                                </FormItem>
                            )} />
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={onClose} disabled={change.isPending}>Cancel</Button>
                                <Button type="submit" loading={change.isPending}>Mark won</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                ) : target ? (
                    <Form {...lost}>
                        <form onSubmit={submitLost} className="space-y-4">
                            <DialogHeader>
                                <DialogTitle>Mark “{target.deal.name}” lost</DialogTitle>
                                <DialogDescription>Pick a reason so the team can see why deals are lost.</DialogDescription>
                            </DialogHeader>
                            <FormField control={lost.control} name="lost_reason_id" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reason</FormLabel>
                                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger aria-label="Loss reason"><SelectValue placeholder={settings.isPending ? "Loading…" : "Choose a reason"} /></SelectTrigger></FormControl>
                                        <SelectContent>{reasons.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={lost.control} name="competitor" render={({ field }) => (
                                <FormItem><FormLabel>Competitor</FormLabel><FormControl><Input placeholder="Who won the deal?" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={lost.control} name="lost_reason" render={({ field }) => (
                                <FormItem><FormLabel>Details</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={onClose} disabled={change.isPending}>Cancel</Button>
                                <Button type="submit" variant="destructive" loading={change.isPending}>Mark lost</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                ) : (
                    <DialogTitle className="sr-only">Close deal</DialogTitle>
                )}
            </DialogContent>
        </Dialog>
    );
}
