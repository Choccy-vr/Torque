import { Search } from "lucide-react";
import AppShell, { PageHeader } from "../components/AppShell.jsx";
import { ProjectPlate } from "../components/ProjectCard.jsx";

// Placeholder cards until Explore is wired up to the project search endpoint.
const PROJECTS = [
    { title: "Drone Project", description: "lorem ipsum eajsngsjankgdaksgdjkgnsa" },
    { title: "Drone Project", description: "lorem ipsum eajsngsjankgdaksgdjkgnsa" },
    { title: "Drone Project", description: "lorem ipsum eajsngsjankgdaksgdjkgnsa rwerejwotjrskwretkeglmfskdrewjtwrekre" },
    { title: "Drone Project", description: "lorem ipsum eajsngsjankgdaksgdjkgnsa rwerejwotjrskwretkeglmfskdrewjtwrekre" },
    { title: "Drone Project", description: "lorem ipsum eajsngsjankgdaksgdjkgnsa rwerejwotjrskwretkeglmfskdrewjtwrekre" },
];

export default function Explore() {
    return (
        <AppShell title="Explore">
            <PageHeader
                title="Explore"
                lede="Builds from across Torque. If a motor makes it move, it counts."
                action={
                    <div role="search" className="relative w-full sm:w-80 lg:w-96">
                        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-(--text)/70" />
                        <input
                            className="min-h-12 w-full rounded-(--radius) border-2 border-(--accent)/55 bg-(--card) py-2 pr-5 pl-13 text-(--text) transition-all duration-300 ease placeholder:text-(--text)/75 hover:border-(--accent)/80 focus:border-(--accent) focus:shadow-none focus:ring-0 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-(--text) [&::-webkit-search-cancel-button]:hidden"
                            type="search"
                            placeholder="Search projects"
                            aria-label="Search projects"
                        />
                    </div>
                }
            />

            <ul className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
                {PROJECTS.map((p, i) => (
                    <li key={i} className="t-card flex h-full flex-col overflow-hidden text-(--text)">
                        <ProjectPlate />
                        <div className="flex flex-1 flex-col gap-2 px-5 py-6 sm:px-6 lg:px-7">
                            <h2 className="text-xl font-semibold text-balance break-words line-clamp-2 text-(--heading) sm:text-2xl">
                                {p.title}
                            </h2>
                            <p className="text-sm break-words line-clamp-3 text-(--text)/80 sm:text-base">
                                {p.description}
                            </p>
                        </div>
                    </li>
                ))}
            </ul>
        </AppShell>
    );
}
