import { isAxiosError } from "axios";

/** Human-readable message from an API error (Nest validation arrays, `{ message, code }` bodies, network errors). */
export function getApiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
    if (isAxiosError(error)) {
        if (!error.response) return "Cannot reach the server. Check your connection and try again.";
        const data = error.response.data as { message?: string | string[] } | undefined;
        const message = data?.message;
        if (Array.isArray(message)) return message.join(". ");
        if (typeof message === "string" && message) return message;
        if (error.response.status === 403) return "You don't have permission to do this.";
        if (error.response.status === 404) return "Not found.";
    }
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

export function getApiErrorStatus(error: unknown): number | null {
    return isAxiosError(error) ? error.response?.status ?? null : null;
}
