import { useCallback } from "react";
import { CloudUpload, Hammer, PencilRuler, Zap } from "lucide-react";
import AdminShell from "../../components/admin/AdminShell.jsx";
import { FilterSelect, ResultList, ResultRow, SearchField, Toolbar } from "../../components/admin/AdminParts.jsx";
import { useParam } from "../../lib/admin.js";
import ProjectStatusBadge from "../../components/ProjectStatusBadge.jsx";
import { searchAdminShips } from "../../lib/endpoints.js";
import { ADMIN_SHIP_STATUS, formatDay } from "../../lib/projects.js";
import { useApi } from "../../lib/useApi.js";

const STATUS_OPTIONS = [["", "Any"], ...Object.entries(ADMIN_SHIP_STATUS).map(([value, { label }]) => [value, label])];

// /admin/ships — every ship, newest first.
export default function AdminShips() {
    return (
        <AdminShell title="Ships">
            <ShipSearch />
        </AdminShell>
    );
}

function ShipSearch() {
    const [q] = useParam("q");
    const [status] = useParam("status");
    const fetchShips = useCallback(() => searchAdminShips({ q, status }), [q, status]);
    const ships = useApi(fetchShips);

    return (
        <div className="flex flex-col gap-6">
            <Toolbar>
                <SearchField label="Search ships" placeholder="Project title, username or any id" />
                <FilterSelect name="status" label="Status" options={STATUS_OPTIONS} />
            </Toolbar>
            <ResultList
                api={ships}
                label="ships"
                empty={q || status
                    ? { title: "No ships match", text: "Try a different search, or clear the status filter." }
                    : { title: "No ships yet", text: "Ships show up here the moment a builder submits one for review." }}
            >
                {(s) => <ShipRow key={s.id} ship={s} />}
            </ResultList>
        </div>
    );
}

export function ShipRow({ ship: s, showProject = true, showUser = true }) {
    const Kind = s.isBuildComplete ? Hammer : PencilRuler;
    return (
        <ResultRow
            to={`/admin/ships/${s.id}`}
            lead={
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[0.625rem] border-2 border-white/15 bg-(--bg)/45">
                    <Kind aria-hidden="true" className="size-4.5 text-(--text)/85" />
                </span>
            }
            title={`${s.isBuildComplete ? "Build" : "Design"} ship${showProject ? ` · ${s.projectTitle}` : ""}`}
            meta={[showUser && s.username, `Shipped ${formatDay(s.createdAt)}`, `${Number(s.hourSnapshot.toFixed(1))}h`].filter(Boolean).join(" · ")}
            trail={
                <>
                    <ProjectStatusBadge status={s.status} statuses={ADMIN_SHIP_STATUS} />
                    {s.pushedToAirtable && (
                        <span title="Pushed to Airtable" className="inline-flex items-center gap-1">
                            <CloudUpload aria-hidden="true" className="size-3.5" />
                            <span className="sr-only">Pushed to Airtable</span>
                            <span aria-hidden="true">Airtable</span>
                        </span>
                    )}
                    {s.voltsGranted > 0 && (
                        <span className="inline-flex items-center gap-1">
                            <Zap aria-hidden="true" className="size-3.5 text-(--accent)" />
                            {s.voltsGranted.toLocaleString()}
                        </span>
                    )}
                    {!s.isBuildComplete && s.requestedFunding > 0 && <span>${s.requestedFunding.toLocaleString()} asked</span>}
                </>
            }
        />
    );
}
