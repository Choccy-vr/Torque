import { NavLink } from "react-router-dom";

export default function Navbar() {
    const links = [
        {name: "Dashboard", path: "/home"},
        {name: "Projects", path: "/projects"},
        {name: "Explore", path: "/explore"},
        {name: "Docs", path: "/docs"},
    ]

    return (
    <>
        <aside className="t-card fixed top-10 bottom-10 left-3 w-[clamp(6rem,18vw,18rem)] md:top-14 md:bottom-14 md:left-6 p-4 sm:p-6 md:p-10 flex flex-col justify-center items-center gap-6 md:gap-10">
            <nav className="flex flex-col text-center gap-6 text-base sm:text-xl md:text-4xl">
                {links.map((link) => (
                    <NavLink
                        key={link.path}
                        to={link.path}
                        className={({isActive }) =>
                            `cursor-pointer transition-all duration-300 ease hover:opacity-75 }` // ${isActive ? "text-red-500" : "text-blue-950"
                        }
                    >
                        {link.name}
                    </NavLink>
                ))}
            </nav>
        </aside>
    </>
    )
}