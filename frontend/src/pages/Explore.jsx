import AppShell, { PageTitle } from "../components/AppShell.jsx";
import Drone from "../assets/drone.png";

export default function Home() {
    return (
        <AppShell title="Explore">
            <PageTitle>Explore</PageTitle>
            <input className="w-full mt-6 py-2 pl-5 rounded-(--radius) bg-(--card) border-2 border-(--accent)/55 text-(--text) placeholder:text-(--text)/60 transition-all duration-300 ease focus:outline-none focus:ring-0 focus:shadow-none focus:border-(--accent)"
                   type="text"
                   placeholder="Search"
                   aria-label="Search projects"
            />

            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
                <div className="t-card flex h-full flex-col overflow-hidden">
                    <img
                        src={Drone}
                        alt="Drone Project"
                        className="aspect-video w-full object-cover"
                    />

                    <div className="flex flex-1 flex-col px-5 py-6 sm:px-6 lg:px-8">
                        <h2 className="mb-2 text-xl font-semibold sm:text-2xl line-clamp-2">
                            Drone Project
                        </h2>
                        <p className="text-sm sm:text-base line-clamp-3">
                            lorem ipsum eajsngsjankgdaksgdjkgnsa
                        </p>
                    </div>
                </div>

                <div className="t-card flex h-full flex-col overflow-hidden">
                    <img
                        src={Drone}
                        alt="Drone Project"
                        className="aspect-video w-full object-cover"
                    />

                    <div className="flex flex-1 flex-col px-5 py-6 sm:px-6 lg:px-8">
                        <h2 className="mb-2 text-xl font-semibold sm:text-2xl line-clamp-2">
                            Drone Project
                        </h2>

                        <p className="text-sm sm:text-base line-clamp-3">
                            lorem ipsum eajsngsjankgdaksgdjkgnsa
                        </p>
                    </div>
                </div>

                <div className="t-card flex h-full flex-col overflow-hidden">
                    <img
                        src={Drone}
                        alt="Drone Project"
                        className="aspect-video w-full object-cover"
                    />

                    <div className="flex flex-1 flex-col px-5 py-6 sm:px-6 lg:px-8">
                        <h2 className="mb-2 text-xl font-semibold line-clamp-2 sm:text-2xl">
                            Drone Project
                        </h2>

                        <p className="text-sm sm:text-base line-clamp-3">
                            lorem ipsum eajsngsjankgdaksgdjkgnsa
                            rwerejwotjrskwretkeglmfskdrewjtwrekre
                        </p>
                    </div>
                </div>

                <div className="t-card flex h-full flex-col overflow-hidden">
                    <img
                        src={Drone}
                        alt="Drone Project"
                        className="aspect-video w-full object-cover"
                    />

                    <div className="flex flex-1 flex-col px-5 py-6 sm:px-6 lg:px-8">
                        <h2 className="mb-2 text-xl font-semibold line-clamp-2 sm:text-2xl">
                            Drone Project
                        </h2>

                        <p className="text-sm sm:text-base line-clamp-3">
                            lorem ipsum eajsngsjankgdaksgdjkgnsa
                            rwerejwotjrskwretkeglmfskdrewjtwrekre
                        </p>
                    </div>
                </div>

                <div className="t-card flex h-full flex-col overflow-hidden">
                    <img
                        src={Drone}
                        alt="Drone Project"
                        className="aspect-video w-full object-cover"
                    />

                    <div className="flex flex-1 flex-col px-5 py-6 sm:px-6 lg:px-8">
                        <h2 className="mb-2 text-xl font-semibold line-clamp-2 sm:text-2xl">
                            Drone Project
                        </h2>

                        <p className="text-sm sm:text-base line-clamp-3">
                            lorem ipsum eajsngsjankgdaksgdjkgnsa
                            rwerejwotjrskwretkeglmfskdrewjtwrekre
                        </p>
                    </div>
                </div>
            </div>
        </AppShell>
    )
}