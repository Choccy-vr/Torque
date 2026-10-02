import { Link, NavLink } from "react-router-dom";
import { BookOpen, Compass, FolderOpen, Gauge, LogIn, LogOut } from "lucide-react";
import { useAuth } from "../lib/useAuth.js";

const links = [
    { name: "Dashboard", path: "/home", icon: Gauge },
    { name: "Projects", path: "/projects", icon: FolderOpen },
    { name: "Explore", path: "/explore", icon: Compass },
    { name: "Docs", path: "/docs", icon: BookOpen },
];

// Active = coral wash + full coral border; the label stays Chalk White so it
// keeps 6:1 contrast (coral text on the wash is only 2.4:1).
const stateClass = (isActive) =>
    isActive
        ? "text-(--text) border-(--accent) bg-(--accent)/15"
        : "text-(--text) border-transparent hover:bg-white/10 hover:border-white/20";

export default function Navbar() {
    const { session, signIn, signOut } = useAuth();
    const AuthIcon = session ? LogOut : LogIn;
    const authLabel = session ? "Log out" : "Log in";
    const onAuth = () => (session ? signOut() : signIn(window.location.pathname));

    return (
        <>
            {/* Phone: wordmark + account action in the page flow */}
            <header className="flex items-center justify-between py-4 md:hidden">
                <Link to="/" className="t-heading text-2xl font-bold tracking-wide">
                    TORQUE
                </Link>
                <button
                    onClick={onAuth}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-transparent px-3 font-medium text-(--text) transition-all duration-300 ease hover:bg-white/10 hover:border-white/20"
                >
                    <AuthIcon aria-hidden="true" className="size-5" />
                    {authLabel}
                </button>
            </header>

            {/* Phone: bottom tab bar, in thumb reach */}
            <div
                aria-hidden="true"
                className="fixed inset-x-0 bottom-0 z-20 h-28 bg-linear-to-b from-transparent to-(--bg) to-40% md:hidden"
            />
            <nav
                aria-label="Main"
                className="t-card fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 flex gap-1 p-1.5 md:hidden"
            >
                {links.map(({ name, path, icon: Icon }) => (
                    <NavLink
                        key={path}
                        to={path}
                        className={({ isActive }) =>
                            `flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-[1.375rem] border-2 text-[0.8125rem] font-medium transition-all duration-300 ease ${stateClass(isActive)}`
                        }
                    >
                        <Icon aria-hidden="true" className="size-5" />
                        {name}
                    </NavLink>
                ))}
            </nav>

            {/* Tablet and up: fixed sidebar */}
            <aside className="t-card fixed top-14 bottom-14 left-6 hidden w-(--sidebar-w) flex-col gap-6 p-4 md:flex lg:p-5">
                <nav aria-label="Main" className="flex flex-col gap-1.5">
                    {links.map(({ name, path, icon: Icon }) => (
                        <NavLink
                            key={path}
                            to={path}
                            className={({ isActive }) =>
                                `flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-base font-medium transition-all duration-300 ease ${stateClass(isActive)}`
                            }
                        >
                            <Icon aria-hidden="true" className="size-5 shrink-0" />
                            {name}
                        </NavLink>
                    ))}
                </nav>
                <button
                    onClick={onAuth}
                    className={`mt-auto flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left text-base font-medium transition-all duration-300 ease ${stateClass(false)}`}
                >
                    <AuthIcon aria-hidden="true" className="size-5 shrink-0" />
                    {authLabel}
                </button>
            </aside>
        </>
    );
}
