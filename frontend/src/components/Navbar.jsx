import { Link, NavLink } from "react-router-dom";
import { BookOpen, CircleUserRound, Compass, FolderOpen, Gauge, LogIn, LogOut, Zap } from "lucide-react";
import { useAuth } from "../lib/useAuth.js";
import { getMyProfile } from "../lib/endpoints.js";
import { useApi } from "../lib/useApi.js";
import Drone from "../assets/img.png";
import logo from "../assets/logo.png";

const links = [
    { name: "Dashboard", path: "/home", icon: Gauge },
    { name: "Projects", path: "/projects", icon: FolderOpen },
    { name: "Explore", path: "/explore", icon: Compass },
    { name: "Docs", path: "/docs", icon: BookOpen },
    { name: "Profile", path: "/profile", icon: CircleUserRound },
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
            <header className="flex items-center justify-between py-4 md:hidden">
                <Link to="/home" className="t-heading font-bold min-w-1/5 w-1/4 tracking-wide shrink-0">
                    <img src={logo} className={"w-full min-w-[100px] h-auto"} alt="Torque home" />
                </Link>
                <div className="flex flex-row items-center">
                    <button
                        onClick={onAuth}
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-transparent px-3 font-medium text-(--text) transition-all duration-300 ease hover:bg-white/10 hover:border-white/20"
                    >
                        <AuthIcon aria-hidden="true" className="size-5" />
                        {authLabel}
                    </button>
                </div>
            </header>

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

            <aside className="t-card fixed top-14 bottom-14 left-6 hidden w-(--sidebar-w) flex-col gap-6 p-4 md:flex lg:p-5">
                <nav aria-label="Main" className="flex flex-col gap-1.5 mt-10">
                    <Link to="/home" className="mb-4 rounded-xl transition-opacity duration-300 ease hover:opacity-80">
                        <img src={logo} alt="Torque home" />
                    </Link>
                    {links.filter(({ name }) => name !== "Profile")
                    .map(({ name, path, icon: Icon }) => (
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
                {session ? (
                    <UserPlate onSignOut={signOut} />
                ) : (
                    <button
                        onClick={onAuth}
                        className={`mt-auto flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left text-base font-medium transition-all duration-300 ease ${stateClass(false)}`}
                    >
                        <AuthIcon aria-hidden="true" className="size-5 shrink-0" />
                        {authLabel}
                    </button>
                )}
            </aside>
        </>
    );
}

// Sidebar footer: who's signed in, as one plate. The avatar, name and Volts
// link to your profile (the plate lights up coral while you're on it), with
// log out ruled off underneath. If the profile request fails,
// fall back to the name from the sign-in session.
function UserPlate({ onSignOut }) {
    const { user } = useAuth();
    const { data: profile, loading } = useApi(getMyProfile);
    const name = profile?.username || user?.user_metadata?.name || user?.user_metadata?.full_name || "Your profile";

    return (
        <div className="mt-auto flex flex-col rounded-2xl border-2 border-white/10 bg-(--bg)/45 p-1 transition-all duration-300 ease has-[a[aria-current=page]]:border-(--accent) has-[a[aria-current=page]]:bg-(--accent)/15">
            <NavLink
                to="/profile"
                end
                aria-label={loading ? "Your profile" : undefined}
                title={loading ? undefined : name}
                className="flex min-w-0 items-center gap-3 rounded-xl p-2 text-left text-(--text) transition-all duration-300 ease hover:bg-white/10"
            >
                <img
                    src={profile?.profilePictureUrl || Drone}
                    onError={(e) => { e.currentTarget.src = Drone; }}
                    alt=""
                    className="size-10 shrink-0 rounded-[0.625rem] border-2 border-(--accent)/55 bg-(--bg) object-cover lg:size-11"
                />
                {loading ? (
                    <div aria-hidden="true" className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <div className="h-4 w-4/5 rounded bg-white/10 motion-safe:animate-pulse" />
                        <div className="h-3.5 w-1/2 rounded bg-white/10 motion-safe:animate-pulse" />
                    </div>
                ) : (
                    <div className="flex min-w-0 flex-col">
                        <span className="truncate leading-snug font-medium">{name}</span>
                        {profile && (
                            <span className="flex items-center gap-1 text-sm leading-snug text-(--text)/80 tabular-nums">
                                <Zap aria-hidden="true" className="size-3.5 shrink-0 text-(--accent)" />
                                {profile.volts.toLocaleString()} Volts
                            </span>
                        )}
                    </div>
                )}
            </NavLink>
            <div aria-hidden="true" className="mx-2 my-1 h-0.5 rounded-full bg-white/10" />
            <button
                type="button"
                onClick={onSignOut}
                className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 text-left text-sm font-medium text-(--text)/80 transition-all duration-300 ease hover:bg-white/10 hover:text-(--text)"
            >
                <LogOut aria-hidden="true" className="size-4 shrink-0" />
                Log out
            </button>
        </div>
    );
}
