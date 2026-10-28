import { useEffect, useRef } from "react";
import { Link, NavLink } from "react-router-dom";
import { FolderOpen, Megaphone, PackageOpen, Settings2, Ship, ShoppingBag, Users } from "lucide-react";
import AppShell, { PageHeader } from "../AppShell.jsx";
import { Empty, InlineError } from "../PageParts.jsx";
import { BTN_PRIMARY, FOCUS } from "../Form.jsx";
import { getAdminStats, getMyProfile } from "../../lib/endpoints.js";
import { isAdmin } from "../../lib/settings.js";
import { useApi } from "../../lib/useApi.js";

const SECTIONS = [
    { name: "Users", path: "/admin/users", icon: Users },
    { name: "Projects", path: "/admin/projects", icon: FolderOpen },
    { name: "Ships", path: "/admin/ships", icon: Ship },
    { name: "Shop items", path: "/admin/shop", icon: ShoppingBag, end: true },
    { name: "Orders", path: "/admin/shop/orders", icon: PackageOpen },
    { name: "Announcements", path: "/admin/announcements", icon: Megaphone },
    { name: "Settings", path: "/admin/settings", icon: Settings2 },
];

// Same states as the sidebar: coral wash + full coral edge when active.
const tabClass = ({ isActive }) =>
    `inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border-2 px-3.5 font-medium whitespace-nowrap text-(--text) transition-all duration-300 ease ${FOCUS} ${
        isActive ? "border-(--accent) bg-(--accent)/15" : "border-transparent hover:border-white/20 hover:bg-white/10"
    }`;

// Frame for every /admin page: the section tabs under one "Admin" title, and
// the admins-only gate. `children` only mounts for admins, so its requests
// never run (and 403) for anyone else.
export default function AdminShell({ title, children }) {
    const me = useApi(getMyProfile);
    const navRef = useRef(null);
    // Phones: the tab row scrolls, so bring the current section into view.
    useEffect(() => {
        navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, []);

    return (
        <AppShell title={`Admin · ${title}`}>
            <PageHeader title="Admin">
                {/* Scrolls sideways on phones; bleeds to the screen edge so tabs aren't clipped mid-word. */}
                <nav ref={navRef} aria-label="Admin sections" className="t-scroll -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                    <ul className="flex gap-1.5 pb-1">
                        {SECTIONS.map(({ name, path, icon: Icon, end }) => (
                            <li key={path}>
                                <NavLink to={path} end={end} className={tabClass}>
                                    <Icon aria-hidden="true" className="size-4.5 shrink-0" />
                                    {name}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </nav>
            </PageHeader>

            <div className="mt-8">
                {me.loading ? (
                    <div aria-busy="true" aria-label="Loading" className="t-card h-64 motion-safe:animate-pulse text-(--text)!" />
                ) : me.error ? (
                    <InlineError what="your profile" onRetry={me.reload} />
                ) : !isAdmin(me.data) ? (
                    <Empty title="Admins only" action={<Link to="/home" className={BTN_PRIMARY}>Back to the dashboard</Link>}>
                        This part of Torque shows everyone's private details, so only admins can open it.
                    </Empty>
                ) : (
                    <div className="flex flex-col gap-8">
                        <Totals />
                        {children}
                    </div>
                )}
            </div>
        </AppShell>
    );
}

const TOTALS = [
    { key: "users", one: "User", many: "Users", icon: Users },
    { key: "projects", one: "Project", many: "Projects", icon: FolderOpen },
    { key: "ships", one: "Ship", many: "Ships", icon: Ship },
];

// Every user, project and ship ever made (banned, archived and rejected too),
// as the shop's strip of ruled cells. Refetched on each tab, so it stays fresh.
function Totals() {
    const stats = useApi(getAdminStats);

    if (stats.error) {
        return (
            <p className="flex flex-wrap items-center gap-x-3 text-sm text-(--text)/80">
                Couldn't load the totals.
                <button
                    type="button"
                    onClick={stats.reload}
                    className={`-mx-3 inline-flex min-h-11 items-center rounded-lg px-3 font-medium text-(--text) underline decoration-(--accent) decoration-2 underline-offset-4 transition-colors duration-300 ease hover:bg-white/10 ${FOCUS}`}
                >
                    Try again
                </button>
            </p>
        );
    }

    return (
        <dl
            aria-label="Totals"
            aria-busy={stats.loading}
            className="grid grid-cols-3 overflow-hidden rounded-2xl border-2 border-white/15 bg-(--card) sm:inline-grid sm:self-start"
        >
            {TOTALS.map(({ key, one, many, icon: Icon }) => {
                const value = stats.data?.[key];
                return (
                    <div key={key} className="-mt-0.5 -ml-0.5 flex min-w-0 flex-col-reverse gap-0.5 border-t-2 border-l-2 border-white/15 px-3.5 py-3 sm:min-w-40 sm:px-4">
                        <dt className="flex items-center gap-1.5 text-sm text-(--text)/75">
                            <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                            {value === 1 ? one : many}
                        </dt>
                        <dd className="text-2xl font-bold text-(--text) tabular-nums">
                            {value == null
                                ? <span aria-hidden="true" className="block h-8 w-14 rounded-lg bg-white/10 motion-safe:animate-pulse" />
                                : value.toLocaleString()}
                        </dd>
                    </div>
                );
            })}
        </dl>
    );
}
