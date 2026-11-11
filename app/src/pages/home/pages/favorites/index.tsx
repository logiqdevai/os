import { Activity, Star } from "lucide-react";
import { Page, PageHeader } from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { usePermissions } from "@/hooks/use-permission";
import { useListParams } from "@/hooks/use-list-params";
import { useHomeFavoriteProjects } from "@/features/home/hooks/use-home";
import { useMyActivity } from "@/features/notifications/hooks/use-notifications";
import { ModuleLabelOptions } from "@/config/constants/dropdowns/notifications/notification.options";
import { getDropdownOptionLabel } from "@/lib/dropdown-option-label.utils";
import { formatRelative } from "@/lib/format";
import { entityLink } from "@/lib/entity-link";
import { Widget, WidgetRow } from "../../components/widget";

/**
 * /home/favorites — pinned items owned by their modules (ProjectFavorite 05) and my recent actions (ActivityEvent, own rows only).
 * @api GET /projects/favorites (projects.projects.read) · GET /activity/mine
 * @gap No cross-module "recently viewed" table; Recent = what I changed (ActivityEvent actor = me).
 */
export default function FavoritesPage() {
    const p = usePermissions();
    const showProjects = p.can("projects.projects.read") && p.moduleEnabled("PROJECTS");
    const favorites = useHomeFavoriteProjects(showProjects);
    const { params, setPage } = useListParams({ limit: 20 });
    const recent = useMyActivity(params);

    return (
        <Page width="wide">
            <PageHeader title="Favorites & recent" description="Pinned items and what you worked on lately." />
            <div className="grid gap-4 lg:grid-cols-2">
                {showProjects && (
                    <Widget title="Favorite projects" icon={Star} loading={favorites.isLoading} error={favorites.error} empty={!favorites.data?.length} emptyTitle="No favorites yet" emptyDescription="Star a project to pin it here.">
                        {(favorites.data ?? []).map((pr) => <WidgetRow key={pr.id} to={`/projects/${pr.id}`} title={pr.name} meta={pr.company?.name ?? "Internal"} />)}
                    </Widget>
                )}
                <Widget title="Recent" icon={Activity} loading={recent.isLoading} error={recent.error} empty={!recent.data?.data.length} emptyTitle="No recent activity" emptyDescription="Records you create or change show up here." className={showProjects ? undefined : "lg:col-span-2"}>
                    {(recent.data?.data ?? []).map((r) => (
                        <WidgetRow key={r.id} to={entityLink(r.entity_type, r.entity_id) ?? undefined} title={r.summary} meta={`${getDropdownOptionLabel(ModuleLabelOptions, r.module)} · ${formatRelative(r.occurred_at)}`} />
                    ))}
                    {recent.data && recent.data.pagination.total_pages > 1 && (
                        <div className="flex justify-end border-t border-border px-3 py-2"><Pagination currentPage={recent.data.pagination.page} totalPages={recent.data.pagination.total_pages} onPageChange={setPage} /></div>
                    )}
                </Widget>
            </div>
        </Page>
    );
}
