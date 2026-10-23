import { useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { Clock, FolderOpen, NotebookPen, Zap } from "lucide-react";
import AppShell from "../components/AppShell.jsx";
import ProjectCard, { ProjectCardSkeleton } from "../components/ProjectCard.jsx";
import { JournalEntry, JournalSkeleton, PagedTimeline } from "../components/Journal.jsx";
import { Empty, InlineError, RetryButton, Section } from "../components/PageParts.jsx";
import SlackIcon from "../components/SlackIcon.jsx";
import { getMyProfile, getUserDevlogs, getUserProfile, getUserProjects } from "../lib/endpoints.js";
import { useApi } from "../lib/useApi.js";
import { Avatar } from "../components/EmptyImage.jsx";

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
    const projectsById = new Map(projectList.map((p) => [p.id, p]));

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
                            <Journal entries={devlogs.data} total={stats?.journals ?? devlogs.data.length} projectsById={projectsById} />
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
                <Avatar src={user.profilePictureUrl} className="size-20 rounded-[1.25rem] border-(--accent) sm:size-24" />
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

// The journal across all of this builder's projects, each entry footed with
// the project it's from.
function Journal({ entries, total, projectsById }) {
    // The endpoint returns the newest 30, so say so once they're all shown.
    const capped = total > entries.length;

    return (
        <PagedTimeline
            items={entries}
            renderItem={(entry) => <JournalEntry key={entry.id} entry={entry} project={projectsById.get(entry.projectId)} />}
            footer={capped && (
                <p className="text-sm text-(--text)/75">
                    Showing the latest {entries.length} of {total} entries.
                </p>
            )}
        />
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
