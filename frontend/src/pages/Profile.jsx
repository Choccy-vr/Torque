import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Clock, FolderOpen, NotebookPen, RotateCw, Zap } from "lucide-react";
import AppShell from "../components/AppShell.jsx";
import ProjectCard, { ProjectCardSkeleton } from "../components/ProjectCard.jsx";
import SlackIcon from "../components/SlackIcon.jsx";
import { getMyProfile, getUserDevlogs, getUserProfile, getUserProjects } from "../lib/endpoints.js";
import { useApi } from "../lib/useApi.js";
import fallbackAvatar from "../assets/img.png";

// /profile is your own profile, /profile/:id is anyone's. Both render the
// same public view (no email or other private fields), so what you see of
// yourself is exactly what everyone else sees.
export default function Profile() {
    const { id } = useParams();
    return id ? <ProfileView key={id} userId={id} /> : <OwnProfile />;
}

function OwnProfile() {
    const { data: me, error, reload } = useApi(getMyProfile);
    if (error) return <ProfileError error={error} onRetry={reload} />;
    if (!me) return <ProfileSkeleton />;
    return <ProfileView userId={me.id} />;
}

const JOURNAL_PAGE = 5;

function ProfileView({ userId }) {
    const fetchProfile = useCallback(() => getUserProfile(userId), [userId]);
    const fetchProjects = useCallback(() => getUserProjects(userId), [userId]);
    const fetchDevlogs = useCallback(() => getUserDevlogs(userId), [userId]);

    const profile = useApi(fetchProfile);
    const projects = useApi(fetchProjects);
    const devlogs = useApi(fetchDevlogs);

    if (profile.error) return <ProfileError error={profile.error} onRetry={profile.reload} />;
    if (!profile.data) return <ProfileSkeleton />;

    const user = profile.data;
    const projectList = projects.data ?? [];
    const projectTitles = new Map(projectList.map((p) => [p.id, p.title]));

    // The devlog endpoint is capped at 30, so count journal entries from the
    // projects' devlog ids instead.
    const stats = projects.data && {
        hours: projectList.reduce((sum, p) => sum + (p.totalHours ?? 0), 0),
        projects: projectList.length,
        journals: projectList.reduce((sum, p) => sum + (p.devlogIds?.length ?? 0), 0),
    };

    return (
        <AppShell title={user.username}>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start xl:grid-cols-[18rem_minmax(0,1fr)] xl:gap-10">
                <IdentityCard user={user} stats={stats} />

                <div className="flex min-w-0 flex-col gap-12">
                    <Section id="projects" title="Projects" count={projects.data?.length}>
                        {projects.loading ? (
                            <ul className={PROJECT_GRID} aria-busy="true" aria-label="Loading projects">
                                {[0, 1].map((i) => <ProjectCardSkeleton key={i} image={false} />)}
                            </ul>
                        ) : projects.error ? (
                            <InlineError what="projects" onRetry={projects.reload} />
                        ) : projectList.length === 0 ? (
                            <Empty title="No projects yet">
                                Once {user.username} starts a project, it shows up here.
                            </Empty>
                        ) : (
                            <ul className={PROJECT_GRID}>
                                {projectList.map((p) => <ProjectCard key={p.id} project={p} titleAs="h3" image={false} quietStatus />)}
                            </ul>
                        )}
                    </Section>

                    <Section id="journal" title="Journal" count={stats?.journals}>
                        {devlogs.loading ? (
                            <JournalSkeleton />
                        ) : devlogs.error ? (
                            <InlineError what="journal entries" onRetry={devlogs.reload} />
                        ) : devlogs.data.length === 0 ? (
                            <Empty title="No journal entries yet">
                                Journal entries are how builders log each work session. {user.username}'s will show up here, newest first.
                            </Empty>
                        ) : (
                            <Journal entries={devlogs.data} total={stats?.journals ?? devlogs.data.length} projectTitles={projectTitles} />
                        )}
                    </Section>
                </div>
            </div>
        </AppShell>
    );
}

const PROJECT_GRID = "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2";

const formatNumber = (n) => (Number.isInteger(n) ? n : n.toFixed(1)).toLocaleString();
const formatJoined = (iso) =>
    new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
const formatDay = (iso) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

// The title block: who this is, how to reach them, and what they've logged.
// Pinned beside the content on wide screens, a header card above it otherwise.
function IdentityCard({ user, stats }) {
    const slackUrl = user.slackUserID
        ? `https://hackclub.slack.com/team/${encodeURIComponent(user.slackUserID)}`
        : null;

    return (
        <section
            aria-labelledby="profile-name"
            className="t-card t-scroll flex flex-col gap-6 p-5 text-(--text) sm:p-6 lg:sticky lg:top-14 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto"
        >
            <div className="flex items-center gap-5 lg:flex-col lg:items-start lg:gap-4">
                <img
                    src={user.profilePictureUrl || fallbackAvatar}
                    onError={(e) => { e.currentTarget.src = fallbackAvatar; }}
                    alt=""
                    className="size-20 shrink-0 rounded-[1.25rem] border-2 border-(--accent) bg-(--bg) object-cover sm:size-24"
                />
                <div className="flex min-w-0 flex-col gap-1">
                    <h1
                        id="profile-name"
                        className="[font-family:var(--heading-font)] text-3xl leading-tight font-bold break-words text-(--accent)"
                    >
                        {user.username}
                    </h1>
                    <p className="text-sm text-(--text)/75">
                        Joined <time dateTime={user.createdAt}>{formatJoined(user.createdAt)}</time>
                    </p>
                </div>
            </div>

            {user.bio && (
                <p className="max-w-[60ch] leading-relaxed whitespace-pre-line break-words text-(--text)/90">{user.bio}</p>
            )}

            {slackUrl && (
                <a
                    href={slackUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2.5 self-start rounded-(--radius) border-2 border-(--accent)/55 px-6 font-bold text-(--text) transition-all duration-300 ease hover:border-(--accent) hover:bg-(--accent)/15 lg:self-stretch"
                >
                    <SlackIcon className="size-4" />
                    Slack profile
                    <span className="sr-only">(opens in a new tab)</span>
                </a>
            )}

            <dl
                aria-busy={!stats}
                className="grid grid-cols-2 gap-0.5 overflow-hidden rounded-2xl border-2 border-white/15 bg-white/15 sm:grid-cols-4 lg:grid-cols-2"
            >
                <Stat icon={Zap} label="Volts" value={user.volts.toLocaleString()} accent />
                <Stat icon={Clock} label="Hours" value={stats && formatNumber(stats.hours)} />
                <Stat icon={FolderOpen} label={stats?.projects === 1 ? "Project" : "Projects"} value={stats?.projects} />
                <Stat icon={NotebookPen} label={stats?.journals === 1 ? "Journal" : "Journals"} value={stats?.journals} />
            </dl>
        </section>
    );
}

// One ruled cell of the title block. `value` is undefined while the projects
// (which the hour/project/journal counts come from) are still loading.
function Stat({ icon: Icon, label, value, accent = false }) {
    return (
        <div className="flex flex-col-reverse justify-end gap-1 bg-(--card) px-4 py-3.5">
            <dt className="flex items-start gap-1.5 text-sm text-(--text)/75">
                <Icon aria-hidden="true" className={`mt-[0.1875rem] size-3.5 shrink-0 ${accent ? "text-(--accent)" : ""}`} />
                {label}
            </dt>
            <dd className="text-2xl font-bold text-(--text) tabular-nums">
                {value ?? <span aria-hidden="true" className="block h-8 w-12 rounded-lg bg-white/10 motion-safe:animate-pulse" />}
            </dd>
        </div>
    );
}

function Section({ id, title, count, children }) {
    return (
        <section aria-labelledby={id} className="flex flex-col gap-5">
            <h2 id={id} className="flex items-baseline gap-3 text-(--text)">
                {/* The docs' coral h2 tick, so sections read as redlined. */}
                <span aria-hidden="true" className="w-1 self-stretch rounded-full bg-(--accent)" />
                <span className="[font-family:var(--heading-font)] text-3xl font-bold">{title}</span>
                {count > 0 && <span className="text-lg font-medium text-(--text)/75 tabular-nums">{count}</span>}
            </h2>
            {children}
        </section>
    );
}

// The journal hangs off a coral redline, one dated tick per entry, newest
// first. Shows a page at a time so a long log doesn't bury the page.
function Journal({ entries, total, projectTitles }) {
    const [shown, setShown] = useState(JOURNAL_PAGE);
    const remaining = entries.length - shown;
    // The endpoint returns the newest 30, so say so once they're all shown.
    const capped = remaining <= 0 && total > entries.length;

    return (
        <div className="flex flex-col gap-6">
            <ol className="flex flex-col gap-8 border-l-2 border-(--accent)/55 pl-(--pad) [--pad:1.25rem] sm:[--pad:1.75rem]">
                {entries.slice(0, shown).map((entry) => (
                    <JournalEntry key={entry.id} entry={entry} project={projectTitles.get(entry.projectId)} />
                ))}
            </ol>
            {remaining > 0 && (
                <button
                    type="button"
                    onClick={() => setShown((n) => n + JOURNAL_PAGE)}
                    className="inline-flex min-h-11 items-center self-start rounded-(--radius) border-2 border-(--accent)/55 px-6 font-bold text-(--text) transition-all duration-300 ease hover:border-(--accent) hover:bg-(--accent)/15"
                >
                    Show {Math.min(remaining, JOURNAL_PAGE)} older {remaining === 1 ? "entry" : "entries"}
                </button>
            )}
            {capped && (
                <p className="text-sm text-(--text)/75">
                    Showing the latest {entries.length} of {total} entries.
                </p>
            )}
        </div>
    );
}

// Long entries collapse behind a toggle; ~360 characters is roughly where
// five lines of the card's measure run out.
const LONG_ENTRY = 360;

// The collapsed text: as many whole paragraphs as fit in LONG_ENTRY, so the
// cut lands on a real paragraph end. Null when even the first paragraph is
// too long, in which case it's clamped with an ellipsis instead.
function excerptOf(text) {
    const [first, ...rest] = text.split(/\n\s*\n/);
    if (first.length > LONG_ENTRY) return null;
    let out = first;
    for (const para of rest) {
        if (out.length + 2 + para.length > LONG_ENTRY) break;
        out += `\n\n${para}`;
    }
    return out;
}

function JournalEntry({ entry, project }) {
    const [open, setOpen] = useState(false);
    const text = entry.text.trim();
    const long = text.length > LONG_ENTRY;
    const excerpt = long ? excerptOf(text) : null;
    const images = entry.imageUrls ?? [];

    return (
        <li className="relative flex flex-col gap-2.5">
            {/* Dated tick: a dot on the 2px redline (cut out of it by a ring of
                page colour) with the entry's date beside it. */}
            <span
                aria-hidden="true"
                className="absolute top-[0.1875rem] left-[calc(-1*var(--pad)-8px)] size-3.5 rounded-full bg-(--accent) ring-4 ring-(--bg)"
            />
            <time dateTime={entry.createdAt} className="text-sm leading-5 font-medium text-(--text)/85 tabular-nums">
                {formatDay(entry.createdAt)}
            </time>
            <article className="t-card flex flex-col gap-2 px-5 py-5 text-(--text) sm:px-7 sm:py-6">
                <h3 className="text-xl font-semibold text-balance break-words text-(--text)">{entry.title}</h3>
                <p
                    id={`entry-${entry.id}`}
                    className={`max-w-[70ch] leading-relaxed whitespace-pre-line break-words text-(--text)/90 ${long && !open && !excerpt ? "line-clamp-5" : ""}`}
                >
                    {long && !open && excerpt ? excerpt : text}
                </p>
                {long && (
                    <button
                        type="button"
                        aria-expanded={open}
                        aria-controls={`entry-${entry.id}`}
                        onClick={() => setOpen((o) => !o)}
                        className="-ml-3 inline-flex min-h-11 items-center self-start rounded-(--radius) px-3 font-medium text-(--text) underline decoration-(--accent) decoration-2 underline-offset-4 transition-all duration-300 ease hover:bg-white/10"
                    >
                        {open ? "Show less" : "Read more"}
                    </button>
                )}
                {images.length > 0 && (
                    <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {images.slice(0, 6).map((src, i) => (
                            <li key={src}>
                                <a
                                    href={src}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block overflow-hidden rounded-xl border-2 border-white/15 transition-all duration-300 ease hover:-translate-y-0.5 hover:border-(--accent) hover:shadow-[0_8px_24px_-12px_var(--accent)] motion-reduce:hover:translate-y-0"
                                >
                                    <img
                                        src={src}
                                        alt={`Photo ${i + 1} from “${entry.title}”`}
                                        loading="lazy"
                                        className="aspect-[4/3] w-full bg-(--bg) object-cover"
                                    />
                                </a>
                            </li>
                        ))}
                    </ul>
                )}
                {project && (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-(--text)/80">
                        <FolderOpen aria-hidden="true" className="size-4 shrink-0" />
                        <span className="sr-only">Project:</span>
                        {project}
                    </p>
                )}
            </article>
        </li>
    );
}

function Empty({ title, children }) {
    return (
        <div className="flex flex-col gap-1.5 rounded-[var(--card-radius)] border-2 border-dashed border-white/20 px-5 py-8 text-(--text) sm:px-7">
            <p className="text-lg font-bold">{title}</p>
            <p className="max-w-[55ch] leading-relaxed text-(--text)/80">{children}</p>
        </div>
    );
}

function InlineError({ what, onRetry }) {
    return (
        <div role="status" className="flex flex-col items-start gap-3 rounded-[var(--card-radius)] border-2 border-dashed border-white/20 px-5 py-6 text-(--text) sm:px-7">
            <p className="leading-relaxed text-(--text)/90">Couldn't load {what}. Check your connection and try again.</p>
            <RetryButton onClick={onRetry} />
        </div>
    );
}

function RetryButton({ onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="t-btn t-hover inline-flex min-h-11 items-center gap-2 rounded-(--radius) px-6 font-bold"
        >
            <RotateCw aria-hidden="true" className="size-4" />
            Try again
        </button>
    );
}

function ProfileError({ error, onRetry }) {
    const missing = error?.status === 404;

    return (
        <AppShell title="Profile">
            <section role="status" className="t-card flex flex-col items-start gap-3 px-5 py-8 text-(--text) sm:px-8 lg:px-12">
                <h1 className="[font-family:var(--heading-font)] text-3xl font-bold">
                    {missing ? "No builder here" : "Couldn't load this profile"}
                </h1>
                <p className="max-w-[60ch] leading-relaxed text-(--text)/85">
                    {missing
                        ? "This profile doesn't exist. The link might be mistyped, or the account was removed."
                        : "Something went wrong talking to the server. Check your connection and try again."}
                </p>
                <div className="mt-2">
                    {missing ? (
                        <Link to="/explore" className="t-btn t-hover inline-flex min-h-11 items-center rounded-(--radius) px-6 font-bold">
                            Explore projects
                        </Link>
                    ) : (
                        <RetryButton onClick={onRetry} />
                    )}
                </div>
            </section>
        </AppShell>
    );
}

function ProfileSkeleton() {
    return (
        <AppShell title="Profile">
            <div aria-busy="true" aria-label="Loading profile" className="grid grid-cols-1 gap-8 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start xl:grid-cols-[18rem_minmax(0,1fr)] xl:gap-10">
                <div className="t-card flex flex-col gap-6 p-5 sm:p-6">
                    <div className="flex items-center gap-5 lg:flex-col lg:items-start lg:gap-4">
                        <div className="size-20 shrink-0 rounded-[1.25rem] bg-white/10 motion-safe:animate-pulse sm:size-24" />
                        <div className="flex w-full flex-col gap-2">
                            <div className="h-8 w-3/4 rounded-lg bg-white/10 motion-safe:animate-pulse" />
                            <div className="h-4 w-1/2 rounded bg-white/10 motion-safe:animate-pulse" />
                        </div>
                    </div>
                    <div className="h-11 w-full rounded-full bg-white/10 motion-safe:animate-pulse" />
                    <div className="h-40 w-full rounded-2xl bg-white/10 motion-safe:animate-pulse" />
                </div>
                <div className="flex flex-col gap-5">
                    <div className="h-9 w-40 rounded-lg bg-white/10 motion-safe:animate-pulse" />
                    <ul className={PROJECT_GRID}>
                        {[0, 1].map((i) => <ProjectCardSkeleton key={i} image={false} />)}
                    </ul>
                </div>
            </div>
        </AppShell>
    );
}

function JournalSkeleton() {
    return (
        <div aria-busy="true" aria-label="Loading journal" className="flex flex-col gap-6 border-l-2 border-(--accent)/30 pl-5 sm:pl-7">
            {[0, 1].map((i) => (
                <div key={i} className="t-card flex flex-col gap-3 px-5 py-6 sm:px-7">
                    <div className="h-4 w-40 rounded bg-white/10 motion-safe:animate-pulse" />
                    <div className="h-6 w-2/3 rounded-lg bg-white/10 motion-safe:animate-pulse" />
                    <div className="h-4 w-full rounded bg-white/10 motion-safe:animate-pulse" />
                    <div className="h-4 w-5/6 rounded bg-white/10 motion-safe:animate-pulse" />
                </div>
            ))}
        </div>
    );
}
