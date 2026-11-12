import { isAxiosError } from "axios";
import axiosInstance from "@/config/api/axios";

/**
 * Download a file the API streams (PDFs, exports) with the caller's credentials and save it in the browser.
 * Blob error bodies are parsed so callers get the API's human-readable message.
 */
export async function downloadFile(url: string, opts: { params?: Record<string, unknown>; headers?: Record<string, string>; fallbackName: string }) {
    try {
        const res = await axiosInstance.get(url, { params: opts.params, headers: opts.headers, responseType: "blob" });
        const disposition = String(res.headers["content-disposition"] ?? "");
        const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
        const name = (encoded ? decodeURIComponent(encoded) : /filename="?([^";]+)"?/.exec(disposition)?.[1]) ?? opts.fallbackName;
        const href = URL.createObjectURL(res.data as Blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(href), 1000);
        return name;
    } catch (error) {
        if (isAxiosError(error) && error.response?.data instanceof Blob) {
            try {
                const body = JSON.parse(await error.response.data.text()) as { message?: string | string[] };
                const message = Array.isArray(body.message) ? body.message.join(". ") : body.message;
                if (message) throw new Error(message);
            } catch (parsed) {
                if (parsed instanceof Error && !(parsed instanceof SyntaxError)) throw parsed;
            }
            if (error.response.status === 403) throw new Error("You don't have permission to download this file.");
            if (error.response.status === 404) throw new Error("The file was not found.");
        }
        throw new Error("The file could not be downloaded. Please try again.");
    }
}
