import { Link } from "react-router-dom";
import { RotateCw } from "lucide-react";
import AppShell, { PageTitle } from "../components/AppShell.jsx";
import { getMyProjects } from "../lib/endpoints.js";
import { useApi } from "../lib/useApi.js";
import ProjectCard, { ProjectCardSkeleton } from "../components/ProjectCard.jsx";

const GRID = "mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 md:mt-8 lg:grid-cols-3 lg:gap-8";

export default function Projects() {
    const { data: projects, error, loading, reload } = useApi(getMyProjects);

    return (
        <AppShell title="Projects">
            <PageTitle>My Projects</PageTitle>

            {loading ? (
                <ul className={GRID} aria-busy="true" aria-label="Loading projects">
                    {[0, 1, 2].map((i) => <ProjectCardSkeleton key={i} />)}
                </ul>
            ) : error ? (
                <Notice
                    title="Couldn't load your projects"
                    body="Something went wrong talking to the server. Check your connection and try again."
                    action={
                        <button onClick={reload} className="t-btn t-hover inline-flex min-h-11 items-center gap-2 rounded-(--radius) px-6 font-bold">
                            <RotateCw aria-hidden="true" className="size-4" />
                            Try again
                        </button>
                    }
                />
            ) : projects.length === 0 ? (
                <Notice
                    title="No projects yet"
                    body="Your projects will show up here once you start one. Not sure what to build? Here's what makes a good Torque project."
                    action={
                        <Link to="/docs/projects/what-is-a-good-project" className="t-btn t-hover inline-flex min-h-11 items-center rounded-(--radius) px-6 font-bold">
                            Project ideas
                        </Link>
                    }
                />
            ) : (
                <ul className={GRID}>
                    {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
                </ul>
            )}
        </AppShell>
    );
}

function Notice({ title, body, action }) {
    return (
        <section role="status" className="t-card mt-6 flex flex-col items-start gap-3 px-5 py-8 sm:px-8 md:mt-8 lg:px-12">
            <h2 className="text-2xl font-bold text-(--heading)">{title}</h2>
            <p className="max-w-[60ch] text-(--text)/85">{body}</p>
            <div className="mt-2">{action}</div>
        </section>
    );
}
