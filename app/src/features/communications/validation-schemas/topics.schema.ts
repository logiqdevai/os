import { z } from "zod";

export const topicFormSchema = z.object({
    name: z.string().trim().min(1, "Enter a name").max(120),
    description: z.string().max(500).optional(),
    channel: z.enum(["ALL", "EMAIL", "SMS"]),
    default_opt_in: z.boolean(),
});
export type TopicFormValues = z.infer<typeof topicFormSchema>;
