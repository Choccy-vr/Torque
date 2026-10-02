import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import AppShell, { PageTitle } from "../components/AppShell.jsx";

export default function Home() {
    return (
        <AppShell title="Dashboard">
            <PageTitle>Dashboard</PageTitle>

            <section
                aria-labelledby="your-projects"
                className="t-card relative mt-6 flex min-h-72 flex-col gap-6 px-5 py-6 sm:px-8 md:mt-8 md:min-h-84 lg:px-12"
            >
                <h2 id="your-projects" className="text-2xl font-bold text-(--text)">Your projects</h2>

                <div className="flex grow flex-col items-center justify-center gap-3 text-center text-(--text)">
                    <p className="text-xl font-bold">No projects yet</p>
                    <p className="max-w-md leading-relaxed text-(--text)/80 [text-wrap:balance]">
                        Any hardware project that uses a motor counts. Set up Lapse and Hackatime first, so every hour gets tracked.
                    </p>
                    <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row">
                        <button
                            type="button"
                            className="t-btn t-hover inline-flex min-h-11 items-center gap-2 rounded-(--radius) px-8 text-lg font-bold"
                        >
                            <Plus aria-hidden="true" className="size-5" strokeWidth={2.5} />
                            Add project
                        </button>
                        <Link
                            to="/docs/getting-started"
                            className="inline-flex min-h-11 items-center rounded-(--radius) border-2 border-(--accent)/55 px-8 text-lg font-bold text-(--text) transition-all duration-300 ease hover:border-(--accent) hover:bg-(--accent)/15"
                        >
                            Read the setup guide
                        </Link>
                    </div>
                </div>
            </section>
        </AppShell>
    );
}
