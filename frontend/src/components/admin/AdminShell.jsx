import { useEffect, useRef } from "react";
import { Link, NavLink } from "react-router-dom";
import { FolderOpen, Megaphone, Settings2, Ship, Users } from "lucide-react";
import AppShell, { PageHeader } from "../AppShell.jsx";
import { Empty, InlineError } from "../PageParts.jsx";
import { BTN_PRIMARY, FOCUS } from "../Form.jsx";
import { getMyProfile } from "../../lib/endpoints.js";
import { isAdmin } from "../../lib/settings.js";
import { useApi } from "../../lib/useApi.js";

const SECTIONS = [
    { name: "Users", path: "/admin/users", icon: Users },
    { name: "Projects", path: "/admin/projects", icon: FolderOpen },
    { name: "Ships", path: "/admin/ships", icon: Ship },
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
                        {SECTIONS.map(({ name, path, icon: Icon }) => (
                            <li key={path}>
                                <NavLink to={path} className={tabClass}>
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
                    children
                )}
            </div>
        </AppShell>
    );
}
