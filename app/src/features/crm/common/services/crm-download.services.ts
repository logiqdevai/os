import axiosInstance from "@/config/api/axios";

/** Download a CSV export (sensitive, audited server-side) with the same filters as the list. */
export async function downloadCsv(url: string, params: Record<string, unknown>, fallbackName: string) {
    const { page: _p, limit: _l, ...filters } = params;
    const res = await axiosInstance.get(url, { params: filters, responseType: "blob" });
    const disposition = String(res.headers["content-disposition"] ?? "");
    const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? fallbackName;
    const href = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
    return Number(res.headers["x-record-count"] ?? 0);
}
