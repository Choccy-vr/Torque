import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import AppShell, { PageHeader } from "../components/AppShell.jsx";
import { getMyProjects } from "../lib/endpoints.js";
import { useApi } from "../lib/useApi.js";
import ProjectCard, { ProjectCardSkeleton } from "../components/ProjectCard.jsx";
import { Empty, InlineError } from "../components/PageParts.jsx";

const GRID = "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8";

export default function Projects() {
    const { data: projects, error, loading, reload } = useApi(getMyProjects);

    return (
        <AppShell title="Projects">
            <PageHeader
                title="My Projects"
                action={
                    <Link
                        to="/projects/new"
                        className="t-btn t-hover inline-flex min-h-11 items-center gap-2 rounded-(--radius) px-7 text-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-(--text)"
                    >
                        <Plus aria-hidden="true" className="size-5" strokeWidth={2.5} />
                        New project
                    </Link>
                }
            />

            <div className="mt-8">
                {loading ? (
                    <ul className={GRID} aria-busy="true" aria-label="Loading projects">
                        {[0, 1, 2].map((i) => <ProjectCardSkeleton key={i} />)}
                    </ul>
                ) : error ? (
                    <InlineError what="your projects" onRetry={reload} />
                ) : projects.length === 0 ? (
                    <Empty
                        title="No projects yet"
                        action={
                            <Link
                                to="/docs/projects/what-is-a-good-project"
                                className="inline-flex min-h-11 items-center rounded-(--radius) border-2 border-(--accent)/55 px-6 font-bold text-(--text) transition-all duration-300 ease hover:border-(--accent) hover:bg-(--accent)/15"
                            >
                                Project ideas
                            </Link>
                        }
                    >
                        Your projects will show up here once you start one. Not sure what to build? Here's what makes a good Torque project.
                    </Empty>
                ) : (
                    <ul className={GRID}>
                        {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
                    </ul>
                )}
            </div>
        </AppShell>
    );
}

