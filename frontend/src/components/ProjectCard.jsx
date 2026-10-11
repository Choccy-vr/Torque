import { Link } from "react-router-dom";
import { Clock, Zap } from "lucide-react";
import ProjectStatusBadge from "./ProjectStatusBadge.jsx";
import { formatHours } from "../lib/projects.js";
import Drone from "../assets/drone.png";

// Project card for /projects, and in `compact` form for the dashboard's
// scrolling row: a fixed-width tile, darker than the panel it sits in, with a
// short image and a one-line title and description.
// Cards show the project's cover image, or the drone placeholder without one.
const SIZES = {
    full: {
        shell: "t-card",
        image: "aspect-video",
        fit: "object-cover",
        body: "gap-3 px-5 py-6 sm:px-6 lg:px-8",
        title: "text-xl line-clamp-2 sm:text-2xl",
        description: "text-sm line-clamp-3 sm:text-base",
        meta: "pt-2",
    },
    compact: {
        shell: "w-64 shrink-0 snap-start rounded-[1.25rem] border-2 border-(--accent)/35 bg-(--bg)/60",
        image: "h-24",
        fit: "object-contain px-4 pt-3",
        body: "gap-2 px-5 py-4",
        title: "text-lg line-clamp-1",
        description: "text-sm line-clamp-1",
        meta: "pt-1",
    },
};

// `image={false}` drops the placeholder image well (the profile, where a
// column of identical placeholders would carry no information). `quietStatus`
// draws every status neutral, for views other people see: "Changes needed"
// is only a call to action for the owner. `hours={false}` leaves out the
// time tracked (staff picks).
export default function ProjectCard({ project, compact = false, titleAs, image = true, quietStatus = false, hours: showHours = true }) {
    const size = compact ? SIZES.compact : SIZES.full;
    // The dashboard and profile nest these under their own h2.
    const Title = titleAs ?? (compact ? "h3" : "h2");
    // Own projects carry totalHoursRaw; the public view calls it totalHours.
    const hours = project.totalHoursRaw ?? project.totalHours ?? 0;

    return (
        // The title's link stretches over the whole card (its ::after), so the
        // card is one click target with one accessible name.
        <li className={`relative flex h-full flex-col overflow-hidden transition-all duration-300 ease hover:-translate-y-0.5 hover:border-(--accent) hover:shadow-[0_8px_24px_-12px_var(--accent)] has-[a:focus-visible]:border-(--accent) motion-reduce:hover:translate-y-0 ${size.shell}`}>
            {image && (
                project.coverImageUrl
                    ? <img src={project.coverImageUrl} alt="" loading="lazy" onError={(e) => { e.currentTarget.src = Drone; }} className={`${size.image} w-full bg-(--bg) object-cover`} />
                    : <img src={Drone} alt="" className={`${size.image} ${size.fit} w-full`} />
            )}

            <div className={`flex flex-1 flex-col ${size.body}`}>
                <ProjectStatusBadge status={project.status} quiet={quietStatus} />

                <Title className={`font-semibold text-balance text-(--heading) ${size.title}`}>
                    <Link
                        to={`/projects/${project.id}`}
                        className="rounded-sm outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline focus-visible:decoration-(--accent) focus-visible:decoration-2 focus-visible:underline-offset-4"
                    >
                        {project.title}
                    </Link>
                </Title>

                {project.description && (
                    <p className={`text-(--text)/80 ${size.description}`}>{project.description}</p>
                )}

                {(showHours || project.voltsGranted > 0) && (
                    <dl className={`mt-auto flex flex-wrap gap-x-5 gap-y-1 ${size.meta} text-sm text-(--text)/85 tabular-nums`}>
                        {showHours && (
                            <div className="flex items-center gap-1.5">
                                <dt><Clock aria-label="Time tracked" className="size-4" /></dt>
                                <dd>{formatHours(hours)}</dd>
                            </div>
                        )}
                        {project.voltsGranted > 0 && (
                            <div className="flex items-center gap-1.5">
                                <dt><Zap aria-label="Volts granted" className="size-4 text-(--accent)" /></dt>
                                <dd>{project.voltsGranted} Volts</dd>
                            </div>
                        )}
                    </dl>
                )}
            </div>
        </li>
    );
}

export function ProjectCardSkeleton({ compact = false, image = true }) {
    const size = compact ? SIZES.compact : SIZES.full;

    return (
        <li aria-hidden="true" className={`flex h-full flex-col overflow-hidden ${size.shell}`}>
            {image && <div className={`${size.image} w-full bg-white/5 motion-safe:animate-pulse`} />}
            <div className={`flex flex-1 flex-col ${size.body}`}>
                <div className="h-6 w-24 rounded-full bg-white/10 motion-safe:animate-pulse" />
                <div className="h-6 w-3/4 rounded-lg bg-white/10 motion-safe:animate-pulse" />
                <div className="h-4 w-full rounded bg-white/10 motion-safe:animate-pulse" />
                <div className="h-4 w-2/3 rounded bg-white/10 motion-safe:animate-pulse" />
            </div>
        </li>
    );
}
