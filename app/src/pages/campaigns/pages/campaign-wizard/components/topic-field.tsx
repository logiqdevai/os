import type { UseFormReturn } from "react-hook-form";
import { FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermission } from "@/hooks/use-permission";
import { useTopics } from "@/features/communications/hooks/use-topics";
import type { CampaignFormValues } from "@/features/communications/validation-schemas/communications.schema";

/**
 * Preference-center topic of a campaign: only contacts subscribed to it receive the campaign (checked again on every send).
 * @perm list topics communications.consents.read (hidden without it)
 * @api GET /communications/topics?channel=
 */
export function TopicField({ form }: { form: UseFormReturn<CampaignFormValues> }) {
    const canRead = usePermission("communications.consents.read");
    const channel = form.watch("channel");
    const topics = useTopics({ limit: 100, channel }, canRead);
    if (!canRead) return null;
    return (
        <FormField control={form.control} name="topic_id" render={({ field }) => (
            <FormItem>
                <FormLabel>Topic</FormLabel>
                <Select value={field.value || "none"} onValueChange={field.onChange} disabled={topics.isPending}>
                    <FormControl><SelectTrigger className="w-full sm:w-72" aria-label="Topic"><SelectValue placeholder="No topic" /></SelectTrigger></FormControl>
                    <SelectContent>
                        <SelectItem value="none">No topic (everyone with consent)</SelectItem>
                        {(topics.data?.data ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                </Select>
                <FormDescription>Contacts who unsubscribed from this topic on the preference page are skipped.</FormDescription>
            </FormItem>
        )} />
    );
}
