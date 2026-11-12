/** Module 11 Communication Center (Campaigns app) — API routes. */
const base = "/communications";

export const CommunicationsApiRoutes = {
    overview: `${base}/overview`,
    provider_status: `${base}/provider-status`,
    settings: `${base}/settings`,
    analytics: { summary: `${base}/analytics/summary` },
    campaigns: {
        list: `${base}/campaigns`,
        detail: (id: string) => `${base}/campaigns/${id}`,
        stats: (id: string) => `${base}/campaigns/${id}/stats`,
        recipients: (id: string) => `${base}/campaigns/${id}/recipients`,
        audience: (id: string) => `${base}/campaigns/${id}/audience`,
        resolve: (id: string) => `${base}/campaigns/${id}/audience/resolve`,
        preflight: (id: string) => `${base}/campaigns/${id}/preflight`,
        test: (id: string) => `${base}/campaigns/${id}/test`,
        variants: (id: string) => `${base}/campaigns/${id}/variants`,
        winner: (id: string, variantId: string) => `${base}/campaigns/${id}/variants/${variantId}/winner`,
        action: (id: string, action: "submit" | "approve" | "reject" | "schedule" | "unschedule" | "pause" | "resume" | "cancel" | "duplicate" | "archive" | "restore") =>
            `${base}/campaigns/${id}/${action}`,
    },
    templates: {
        list: `${base}/templates`,
        preview: `${base}/templates/preview`,
        detail: (id: string) => `${base}/templates/${id}`,
        versions: (id: string) => `${base}/templates/${id}/versions`,
        version: (id: string, versionId: string) => `${base}/templates/${id}/versions/${versionId}`,
        publish: (id: string, versionId: string) => `${base}/templates/${id}/versions/${versionId}/publish`,
        action: (id: string, action: "duplicate" | "archive" | "restore") => `${base}/templates/${id}/${action}`,
    },
    segments: {
        list: `${base}/segments`,
        fields: `${base}/segments/fields`,
        preview: `${base}/segments/preview`,
        detail: (id: string) => `${base}/segments/${id}`,
        members: (id: string) => `${base}/segments/${id}/members`,
        action: (id: string, action: "refresh" | "archive" | "restore") => `${base}/segments/${id}/${action}`,
    },
    lists: {
        list: `${base}/lists`,
        detail: (id: string) => `${base}/lists/${id}`,
        members: (id: string) => `${base}/lists/${id}/members`,
        member: (id: string, memberId: string) => `${base}/lists/${id}/members/${memberId}`,
        action: (id: string, action: "archive" | "restore") => `${base}/lists/${id}/${action}`,
    },
    consents: {
        list: `${base}/consents`,
        contact: (contactId: string) => `${base}/consents/${contactId}`,
        set: (contactId: string, channel: string) => `${base}/consents/${contactId}/${channel}`,
    },
    topics: {
        list: `${base}/topics`,
        detail: (id: string) => `${base}/topics/${id}`,
        action: (id: string, action: "archive" | "restore") => `${base}/topics/${id}/${action}`,
        contact: (contactId: string) => `${base}/topics/contacts/${contactId}`,
    },
    ai: {
        status: `${base}/ai/status`,
        generate: `${base}/ai/generate`,
        feedback: (id: string) => `${base}/ai/generations/${id}/feedback`,
    },
    threads: {
        list: `${base}/threads`,
        detail: (id: string) => `${base}/threads/${id}`,
        reply: (id: string) => `${base}/threads/${id}/reply`,
        action: (id: string, action: "archive" | "restore") => `${base}/threads/${id}/${action}`,
    },
    suppressions: {
        list: `${base}/suppressions`,
        remove: (id: string) => `${base}/suppressions/${id}/remove`,
    },
    messages: {
        list: `${base}/messages`,
        detail: (id: string) => `${base}/messages/${id}`,
        action: (id: string, action: "send" | "resend" | "cancel" | "archive" | "restore") => `${base}/messages/${id}/${action}`,
    },
    senders: {
        domains: `${base}/sender-domains`,
        domain: (id: string) => `${base}/sender-domains/${id}`,
        verify_domain: (id: string) => `${base}/sender-domains/${id}/verify`,
        identities: `${base}/sender-identities`,
        identity: (id: string) => `${base}/sender-identities/${id}`,
        verify_identity: (id: string) => `${base}/sender-identities/${id}/verify`,
    },
};
