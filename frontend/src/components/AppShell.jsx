import Navbar from "./Navbar.jsx";

// Shared frame for the signed-in pages: blueprint grid, navigation, and a
// content column. Below md the sidebar becomes a top bar + bottom tab bar.
export default function AppShell({ title, children }) {
    return (
        <div className="t-shell min-h-screen bg-(--bg) md:[--sidebar-w:13rem] lg:[--sidebar-w:15rem]">
            <title>{`Torque - ${title}`}</title>
            <a
                href="#main"
                className="t-btn sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 rounded-(--radius) px-5 py-2 font-bold"
            >
                Skip to content
            </a>

            <div className="t-bg fixed inset-0 z-0" />
            <div className="fixed inset-0 z-0 bg-black/20 opacity-(--overlay)" />

            <div className="relative z-10 px-4 pb-32 sm:px-6 md:pb-14 md:pr-10 md:pl-[calc(var(--sidebar-w)+4rem)]">
                <Navbar />
                <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl pt-2 md:pt-28">
                    {children}
                </main>
            </div>
        </div>
    );
}

export function PageTitle({ children }) {
    return (
        <h1 className="[font-family:var(--heading-font)] text-4xl lg:text-5xl font-bold leading-tight text-(--accent)">
            {children}
        </h1>
    );
}
