import { useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRightLeft, CalendarClock, Handshake, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { usePermission } from "@/hooks/use-permission";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useChangeDealStage } from "@/features/crm/deals/hooks/use-deals";
import type { BoardStage, Deal, DealBoard as DealBoardData } from "@/features/crm/deals/interfaces/deals.interfaces";
import { CrmPaths } from "../../../crm-paths";
import { MemberAvatar, Money, ToneDot } from "../../../components/crm-ui";
import { CloseDealDialog, type CloseDealTarget } from "../../../components/close-deal-dialog";

const DRAG_TYPE = "application/x-crm-deal";

interface Props {
    board: DealBoardData | undefined;
    loading: boolean;
    error: unknown;
    onRetry: () => void;
    onCreate: (stageId: string) => void;
}

/**
 * Kanban board (02 §8). Native HTML5 drag between columns on pointer devices; every card also has a
 * "Move to" menu so touch screens and keyboards can change the stage. Won/lost drops open the close dialog.
 * @perm drag/move crm.deals.change_stage · quick add crm.deals.create
 */
export function DealBoard({ board, loading, error, onRetry, onCreate }: Props) {
    const change = useChangeDealStage();
    const canMove = usePermission("crm.deals.change_stage");
    const canCreate = usePermission("crm.deals.create");
    const [dragging, setDragging] = useState<string | null>(null);
    const [over, setOver] = useState<string | null>(null);
    const [closing, setClosing] = useState<CloseDealTarget | null>(null);

    const move = (deal: Deal, stage: BoardStage) => {
        if (deal.stage_id === stage.id) return;
        if (stage.is_won || stage.is_lost) {
            setClosing({ deal, stage_id: stage.id, mode: stage.is_won ? "won" : "lost", stage });
            return;
        }
        // Optimistic: the card moves at once; a refusal moves it back and toasts.
        change.mutate({ id: deal.id, stage_id: stage.id, stage });
    };

    if (loading && !board) {
        return (
            <div className="flex gap-3 overflow-hidden">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-96 w-72 shrink-0 rounded-lg" />)}
            </div>
        );
    }
    if (error) return <div className="rounded-lg border border-border bg-card"><ErrorState error={error} onRetry={onRetry} /></div>;
    if (!board) return null;

    const allDeals = board.stages.flatMap((s) => s.deals);
    const find = (id: string) => allDeals.find((d) => d.id === id);

    return (
        <>
            <div className="-mx-4 overflow-x-auto px-4 pb-3 md:-mx-6 md:px-6" role="list" aria-label={`${board.pipeline.name} pipeline`}>
                <div className="flex snap-x snap-mandatory gap-3 md:snap-none">
                    {board.stages.map((stage) => (
                        <section
                            key={stage.id}
                            role="listitem"
                            aria-label={`${stage.name}, ${stage.count} deals`}
                            className={cn(
                                "flex w-[82vw] max-w-[19rem] shrink-0 snap-start flex-col rounded-lg border border-border bg-secondary/60 sm:w-72",
                                over === stage.id && dragging && "border-border-strong bg-accent",
                            )}
                            onDragOver={(e: DragEvent) => {
                                if (!dragging || !e.dataTransfer.types.includes(DRAG_TYPE)) return;
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                                if (over !== stage.id) setOver(stage.id);
                            }}
                            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}
                            onDrop={(e) => {
                                e.preventDefault();
                                const id = e.dataTransfer.getData(DRAG_TYPE);
                                setOver(null);
                                setDragging(null);
                                const deal = find(id);
                                if (deal) move(deal, stage);
                            }}
                        >
                            <header className="border-b border-border px-3 py-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <ToneDot tone={stage.color} />
                                        <h3 className="truncate text-[13px] font-medium text-foreground">{stage.name}</h3>
                                        <span className="text-xs text-muted-foreground tabular">{stage.count}</span>
                                    </div>
                                    {canCreate && !stage.is_won && !stage.is_lost && (
                                        <Button variant="ghost" size="icon-sm" aria-label={`New deal in ${stage.name}`} onClick={() => onCreate(stage.id)}><Plus /></Button>
                                    )}
                                </div>
                                <div className="mt-0.5 flex items-center justify-between text-xs text-muted-foreground">
                                    <Money value={stage.total_value} currency={board.pipeline.currency} compact />
                                    {!stage.is_won && !stage.is_lost ? <span>{stage.probability}% · <Money value={stage.weighted_value} currency={board.pipeline.currency} compact /></span> : <span>last 30 days</span>}
                                </div>
                            </header>
                            <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">
                                {stage.deals.map((deal) => (
                                    <DealCard
                                        key={deal.id}
                                        deal={deal}
                                        currency={board.pipeline.currency}
                                        stages={board.stages}
                                        canMove={canMove}
                                        dragging={dragging === deal.id}
                                        onDragStart={(e) => { e.dataTransfer.setData(DRAG_TYPE, deal.id); e.dataTransfer.effectAllowed = "move"; setDragging(deal.id); }}
                                        onDragEnd={() => { setDragging(null); setOver(null); }}
                                        onMove={(s) => move(deal, s)}
                                    />
                                ))}
                                {!stage.deals.length && <p className="px-1 py-6 text-center text-xs text-ash">{canMove ? "Drop deals here" : "No deals"}</p>}
                                {stage.count > stage.deals.length && <p className="px-1 text-center text-xs text-muted-foreground">+{stage.count - stage.deals.length} more in the list view</p>}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
            {!allDeals.length && (
                <EmptyState
                    icon={Handshake}
                    title="No deals in this pipeline yet"
                    description="Create a deal, or convert a qualified lead."
                    action={canCreate ? <Button size="sm" onClick={() => onCreate(board.stages[0]?.id)}><Plus /> New deal</Button> : undefined}
                />
            )}
            <CloseDealDialog target={closing} onClose={() => setClosing(null)} />
        </>
    );
}

function DealCard({ deal, currency, stages, canMove, dragging, onDragStart, onDragEnd, onMove }: {
    deal: Deal;
    currency: string | null;
    stages: BoardStage[];
    canMove: boolean;
    dragging: boolean;
    onDragStart: (e: DragEvent) => void;
    onDragEnd: () => void;
    onMove: (stage: BoardStage) => void;
}) {
    const overdue = deal.status === "OPEN" && !!deal.expected_close_date && new Date(deal.expected_close_date).getTime() < Date.now() - 86400_000;
    return (
        <article
            draggable={canMove}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            className={cn("group rounded-md border border-border bg-card p-2.5 shadow-xs transition-colors hover:border-border-strong", canMove && "cursor-grab active:cursor-grabbing", dragging && "opacity-50")}
        >
            <div className="flex items-start justify-between gap-2">
                <Link to={CrmPaths.deal(deal.id)} className="min-w-0 text-[13px] font-medium leading-snug text-foreground hover:underline" draggable={false}>
                    {deal.name}
                </Link>
                {canMove && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" className="-mr-1 -mt-1 size-6 shrink-0 opacity-70 group-hover:opacity-100" aria-label={`Move ${deal.name}`}>
                                <ArrowRightLeft className="size-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Move to</DropdownMenuLabel>
                            {stages.filter((s) => s.id !== deal.stage_id).map((s) => (
                                <DropdownMenuItem key={s.id} onSelect={() => onMove(s)}>
                                    <ToneDot tone={s.color} /> {s.name}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
            {deal.company && <div className="mt-0.5 truncate text-xs text-muted-foreground">{deal.company.name}</div>}
            <div className="mt-2 flex items-center justify-between gap-2">
                <Money value={deal.value} currency={deal.currency ?? currency} className="text-[13px] font-medium text-foreground" />
                <MemberAvatar member={deal.owner} />
            </div>
            {(deal.expected_close_date || deal.is_stale) && (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                    {deal.expected_close_date && (
                        <span className={cn("inline-flex items-center gap-1", overdue ? "text-danger" : "text-muted-foreground")}>
                            <CalendarClock className="size-3" /> {formatDate(deal.expected_close_date, "d MMM")}
                        </span>
                    )}
                    {deal.is_stale && <span className="inline-flex items-center gap-1 text-warning"><AlertTriangle className="size-3" /> Stale</span>}
                </div>
            )}
        </article>
    );
}
