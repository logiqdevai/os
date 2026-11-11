import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { MessagesSquare } from "lucide-react";
import { EmptyState } from "@/components/ui/states";
import { usePageMetadata } from "@/hooks/use-page-metadata";
import { cn } from "@/lib/utils";
import { ConversationList } from "./components/conversation-list";
import { ConversationPane } from "./components/conversation-pane";
import { SUPPORT_PATHS } from "../../support-paths";

/**
 * Support inbox — /support and /support/c/:conversationId (13 §1, mockup 13-support `inbox`).
 * Three panes filling the main area: list · thread + composer · details (xl+, a sheet below).
 * Phones: the list and the thread are separate views.
 * @perm VIEW support.conversations.read · reply support.conversations.reply · assign .assign · resolve .close
 */
export default function InboxPage() {
    usePageMetadata({ title: "Inbox" });
    const { conversationId } = useParams();
    const [sp, setSp] = useSearchParams();
    const view = sp.get("view") ?? "mine";
    const status = sp.get("status") ?? "OPEN,PENDING";
    const page = Number(sp.get("page") ?? 1) || 1;
    const [search, setSearch] = useState(sp.get("q") ?? "");
    const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches);

    useEffect(() => {
        const mq = window.matchMedia("(min-width: 1280px)");
        const on = () => setWide(mq.matches);
        mq.addEventListener("change", on);
        return () => mq.removeEventListener("change", on);
    }, []);

    useEffect(() => {
        const t = setTimeout(() => {
            if ((sp.get("q") ?? "") === search) return;
            setSp((prev) => {
                const n = new URLSearchParams(prev);
                if (search) n.set("q", search); else n.delete("q");
                n.delete("page");
                return n;
            }, { replace: true });
        }, 300);
        return () => clearTimeout(t);
    }, [search, sp, setSp]);

    const set = (key: string, value: string | null) =>
        setSp((prev) => {
            const n = new URLSearchParams(prev);
            if (value) n.set(key, value); else n.delete(key);
            if (key !== "page") n.delete("page");
            return n;
        });
    const query = sp.toString();

    return (
        <div className="flex h-full min-h-0">
            <aside className={cn("w-full shrink-0 border-r border-border md:w-80 lg:w-96", conversationId ? "hidden md:block" : "block")}>
                <ConversationList
                    selectedId={conversationId}
                    view={view}
                    status={status}
                    search={search}
                    page={page}
                    onView={(v) => set("view", v)}
                    onStatus={(v) => set("status", v)}
                    onSearch={setSearch}
                    onPage={(p) => set("page", p > 1 ? String(p) : null)}
                    hrefFor={(id) => `${SUPPORT_PATHS.conversation(id)}${query ? `?${query}` : ""}`}
                />
            </aside>
            <section className={cn("min-w-0 flex-1", conversationId ? "block" : "hidden md:block")}>
                {conversationId ? (
                    <ConversationPane key={conversationId} id={conversationId} showDetailsInline={wide} />
                ) : (
                    <EmptyState icon={MessagesSquare} title="Pick a conversation" description="Select a conversation on the left to read and reply." className="h-full" />
                )}
            </section>
        </div>
    );
}
