import { z } from "zod";

const IP = /^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/;
export const parseList = (raw: string) => raw.split(/[\s,]+/).map((v) => v.trim()).filter(Boolean);

export const apiKeyFormSchema = z.object({
    name: z.string().trim().min(2, "Use at least 2 characters").max(80),
    owner: z.string(),
    expiry: z.enum(["30", "90", "180", "365", "never"]),
    allowed_ip_ranges: z.string().refine((v) => parseList(v).every((ip) => IP.test(ip)), "Use IPv4 addresses or CIDR ranges, e.g. 10.0.0.0/24"),
});
export type ApiKeyFormValues = z.infer<typeof apiKeyFormSchema>;
