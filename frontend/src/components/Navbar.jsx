import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/useAuth.js";

export default function Navbar() {
    const { session, signIn, signOut } = useAuth();

    const links = [
        {name: "Dashboard", path: "/home"},
        {name: "Projects", path: "/projects"},
        {name: "Explore", path: "/explore"},
        {name: "Docs", path: "/docs"},
    ]

    return (
    <>
        <aside className="t-card fixed top-10 bottom-10 left-3 w-[clamp(6rem,18vw,18rem)] md:top-14 md:bottom-14 md:left-6 p-4 sm:p-6 md:p-10 flex flex-col justify-start items-center gap-6 md:gap-10">
            <nav className="flex flex-col w-full gap-1.5 md:gap-2 text-sm lg:text-base xl:text-xl 2xl:text-2xl">
                {links.map((link) => (
                    <NavLink
                        key={link.path}
                        to={link.path}
                        className={({ isActive }) =>
                            `cursor-pointer text-left font-medium rounded-xl border-2 px-2 py-2 lg:px-3 lg:py-2.5 xl:px-4 xl:py-3 transition-all duration-300 ease ${
                                isActive
                                    ? "text-(--accent) border-(--accent) bg-(--accent)/15"
                                    : "text-(--text) border-transparent hover:bg-white/10 hover:border-white/20"
                            }`
                        }
                    >
                        {link.name}
                    </NavLink>
                ))}
            </nav>
            <button
                onClick={() => (session ? signOut() : signIn(window.location.pathname))}
                className="mt-auto cursor-pointer w-full text-left font-medium rounded-xl border-2 border-transparent px-2 py-2 lg:px-3 lg:py-2.5 xl:px-4 xl:py-3 text-sm lg:text-base xl:text-xl 2xl:text-2xl text-(--text) hover:bg-white/10 hover:border-white/20 transition-all duration-300 ease"
            >
                {session ? "Log Out" : "Log In"}
            </button>
        </aside>
    </>
    )
}
