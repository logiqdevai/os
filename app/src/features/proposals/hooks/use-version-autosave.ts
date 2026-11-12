import { useEffect, useRef, useState } from "react";
import { useAutosave, type AutosaveState } from "@/hooks/use-autosave";
import type { ProposalDetail, SaveContentDto } from "../interfaces/proposals.interfaces";
import { useAutosaveProposalContent } from "./use-proposals";

const ser = (v: unknown) => JSON.stringify(v);

/**
 * Local draft of one part of a proposal version (sections, line items, payment schedule) that autosaves to
 * `PUT /proposals/:id/versions/:vid/content` — no Save / Discard buttons (Linear-style).
 *
 * - `toDraft` reads the draft from the server data, `toPayload` turns it into the API body part.
 * - `key` is what decides "changed" (defaults to the payload); give it when the payload carries server ids that
 *   must not trigger another save once they come back (`merge` copies them into the draft).
 * - Server refreshes (after a save, AI draft, another tab…) replace the draft only when there are no unsaved local
 *   edits, so typing is never overwritten; switching version always resets the draft.
 * - Invalid drafts (`valid` false) are not sent; the editor shows why.
 */
export function useVersionAutosave<TDraft>({
    proposal, editable, toDraft, toPayload, key = toPayload, valid = () => true, merge,
}: {
    proposal: ProposalDetail;
    editable: boolean;
    toDraft: (p: ProposalDetail) => TDraft;
    toPayload: (d: TDraft) => Omit<SaveContentDto, "change_summary">;
    key?: (d: TDraft) => unknown;
    valid?: (d: TDraft) => boolean;
    merge?: (local: TDraft, server: TDraft) => TDraft;
}): { draft: TDraft; setDraft: React.Dispatch<React.SetStateAction<TDraft>>; autosave: AutosaveState; dirty: boolean } {
    const save = useAutosaveProposalContent();
    const versionId = proposal.version?.id;
    const [draft, setDraft] = useState<TDraft>(() => toDraft(proposal));
    const draftRef = useRef(draft);
    draftRef.current = draft;
    const synced = useRef(ser(key(draft))); // what the server has, as far as this editor knows

    // Switching version: start over from that version.
    useEffect(() => {
        const next = toDraft(proposal);
        synced.current = ser(key(next));
        setDraft(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [versionId]);

    // Server refresh: same content → keep the draft (merging new ids); no local edits → take the server's version.
    useEffect(() => {
        const server = toDraft(proposal);
        const s = ser(key(server));
        const local = ser(key(draftRef.current));
        if (local === s) { if (merge) setDraft((d) => merge(d, server)); }
        else if (local === synced.current) setDraft(server);
        synced.current = s;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [proposal]);

    const serverKey = ser(key(toDraft(proposal)));
    const dirty = ser(key(draft)) !== serverKey;
    const autosave = useAutosave({
        value: key(draft),
        enabled: editable && !!versionId && valid(draft),
        save: async () => {
            const sending = draftRef.current;
            await save.mutateAsync({ id: proposal.id, versionId: versionId as string, ...toPayload(sending) });
            synced.current = ser(key(sending));
        },
    });
    return { draft, setDraft, autosave, dirty };
}
