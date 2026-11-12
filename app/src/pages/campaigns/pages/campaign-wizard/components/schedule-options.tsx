import type { UseFormReturn } from "react-hook-form";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CampaignFormValues } from "@/features/communications/validation-schemas/communications.schema";
import { TimezoneOptions } from "@/config/constants/dropdowns/timezone.options";
import { CampaignRepeatOptions, WeekdayOptions } from "@/config/constants/dropdowns/communications/campaign-ab.options";

/**
 * Time zone, recipient-time-zone delivery and repeat (RRULE) of a campaign — schedule step of the wizard.
 * @api PATCH /communications/campaigns/:id (schedule_timezone, send_in_recipient_timezone, recurrence_rule, recurrence_ends_at)
 */
export function ScheduleOptions({ form }: { form: UseFormReturn<CampaignFormValues> }) {
    const [sendMode, repeat] = form.watch(["send_mode", "repeat"]);
    const zone = form.watch("schedule_timezone");
    const zones = TimezoneOptions.some((z) => z.value === zone) ? TimezoneOptions : [{ value: zone, label: zone }, ...TimezoneOptions];
    return (
        <div className="space-y-5">
            <FormField control={form.control} name="schedule_timezone" render={({ field }) => (
                <FormItem>
                    <FormLabel>Time zone of the send time</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl><SelectTrigger className="w-full sm:w-80" aria-label="Time zone"><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>{zones.map((z) => <SelectItem key={z.value} value={z.value}>{z.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )} />
            <FormField control={form.control} name="send_in_recipient_timezone" render={({ field }) => (
                <FormItem className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-3">
                    <div className="space-y-0.5">
                        <FormLabel>Deliver in each recipient's time zone</FormLabel>
                        <FormDescription>Contacts with a time zone get the message at the same local time (e.g. 9:00 for everyone). Others get it at the campaign time.</FormDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={sendMode !== "later"} aria-label="Deliver in each recipient's time zone" /></FormControl>
                </FormItem>
            )} />
            {sendMode === "later" && (
                <div className="space-y-3 rounded-lg border border-border bg-card p-3">
                    <FormField control={form.control} name="repeat" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Repeat</FormLabel>
                            <Select value={field.value} onValueChange={field.onChange}>
                                <FormControl><SelectTrigger className="w-full sm:w-56" aria-label="Repeat"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>{CampaignRepeatOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                            </Select>
                            <FormDescription>Each run sends to the people in the audience at that time. A/B tests are not available on repeating campaigns.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )} />
                    {repeat !== "NONE" && (
                        <div className="grid gap-3 sm:grid-cols-2">
                            <FormField control={form.control} name="repeat_interval" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Every</FormLabel>
                                    <div className="flex items-center gap-2">
                                        <FormControl><Input inputMode="numeric" className="w-20" {...field} /></FormControl>
                                        <span className="text-[13px] text-muted-foreground">{repeat === "DAILY" ? "day(s)" : repeat === "WEEKLY" ? "week(s)" : "month(s)"}</span>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="repeat_until" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Ends on</FormLabel>
                                    <FormControl><Input type="date" className="w-full sm:w-44" {...field} value={field.value ?? ""} /></FormControl>
                                    <FormDescription>Empty = keeps repeating.</FormDescription>
                                </FormItem>
                            )} />
                            {repeat === "WEEKLY" && (
                                <FormField control={form.control} name="repeat_days" render={({ field }) => (
                                    <FormItem className="sm:col-span-2">
                                        <FormLabel>On</FormLabel>
                                        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Weekdays">
                                            {WeekdayOptions.map((d) => {
                                                const on = field.value.includes(d.id);
                                                return (
                                                    <button
                                                        key={d.id}
                                                        type="button"
                                                        aria-pressed={on}
                                                        aria-label={d.label}
                                                        onClick={() => field.onChange(on ? field.value.filter((x) => x !== d.id) : [...field.value, d.id])}
                                                        className={cn("grid size-8 place-items-center rounded-md border text-xs font-medium", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground hover:text-foreground")}
                                                    >
                                                        {d.short}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
