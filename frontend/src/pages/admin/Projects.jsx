import { useCallback } from "react";
import { Archive, Clock, Star, Zap } from "lucide-react";
import AdminShell from "../../components/admin/AdminShell.jsx";
import { FilterSelect, ResultList, ResultRow, SearchField, Tag, Toolbar } from "../../components/admin/AdminParts.jsx";
import { useParam } from "../../lib/admin.js";
import ProjectStatusBadge from "../../components/ProjectStatusBadge.jsx";
import { searchAdminProjects } from "../../lib/endpoints.js";
import { ADMIN_PROJECT_STATUS, formatDay } from "../../lib/projects.js";
import { useApi } from "../../lib/useApi.js";

const STATUS_OPTIONS = [["", "Any"], ...Object.entries(ADMIN_PROJECT_STATUS).map(([value, { label }]) => [value, label])];
const ARCHIVED_OPTIONS = [["", "Any"], ["false", "Active"], ["true", "Archived"]];

// /admin/projects — every project, any status, archived ones too.
export default function AdminProjects() {
    return (
        <AdminShell title="Projects">
            <ProjectSearch />
        </AdminShell>
    );
}

function ProjectSearch() {
    const [q] = useParam("q");
    const [status] = useParam("status");
    const [archived] = useParam("archived");
    const fetchProjects = useCallback(() => searchAdminProjects({ q, status, archived }), [q, status, archived]);
    const projects = useApi(fetchProjects);
    const filtered = Boolean(q || status || archived);

    return (
        <div className="flex flex-col gap-6">
            <Toolbar>
                <SearchField label="Search projects" placeholder="Title, owner username or id" />
                <FilterSelect name="status" label="Status" options={STATUS_OPTIONS} />
                <FilterSelect name="archived" label="Showing" options={ARCHIVED_OPTIONS} />
            </Toolbar>
            <ResultList
                api={projects}
                label="projects"
                empty={filtered
                    ? { title: "No projects match", text: "Try a different search, or clear the filters." }
                    : { title: "No projects yet", text: "Projects show up here as soon as someone starts one." }}
            >
                {(p) => <ProjectRow key={p.id} project={p} />}
            </ResultList>
        </div>
    );
}

export function ProjectRow({ project: p, showOwner = true }) {
    return (
        <ResultRow
            to={`/admin/projects/${p.id}`}
            lead={<ProjectThumb src={p.coverImageUrl} />}
            title={p.title}
            meta={[showOwner && (p.ownerUsername || "Unknown owner"), `Level ${p.tier}`, `Started ${formatDay(p.createdAt)}`].filter(Boolean).join(" · ")}
            trail={
                <>
                    {p.isArchived && <Tag><Archive aria-hidden="true" className="size-3.5" />Archived</Tag>}
                    {p.isStaffPick && <Tag><Star aria-hidden="true" className="size-3.5" />Staff pick</Tag>}
                    <ProjectStatusBadge status={p.status} statuses={ADMIN_PROJECT_STATUS} />
                    <span className="inline-flex items-center gap-1">
                        <Clock aria-hidden="true" className="size-3.5" />
                        {Number(p.totalHours.toFixed(1))}h
                    </span>
                    {p.voltsGranted > 0 && (
                        <span className="inline-flex items-center gap-1">
                            <Zap aria-hidden="true" className="size-3.5 text-(--accent)" />
                            {p.voltsGranted.toLocaleString()}
                        </span>
                    )}
                </>
            }
        />
    );
}

// The cover as a small tile, or an empty drafting square.
function ProjectThumb({ src }) {
    return src ? (
        <img src={src} alt="" className="size-10 shrink-0 rounded-[0.625rem] border-2 border-white/15 bg-(--bg) object-cover" />
    ) : (
        <span aria-hidden="true" className="t-plate size-10 shrink-0 rounded-[0.625rem] border-2 border-dashed border-white/20" />
    );
}
