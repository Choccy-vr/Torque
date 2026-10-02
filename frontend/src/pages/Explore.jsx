import AppShell, { PageTitle } from "../components/AppShell.jsx";
// import Drone from "../assets/drone.png";

export default function Home() {
    return (
        <AppShell title="Explore">
            <PageTitle>Explore</PageTitle>
            <input className="w-full mt-6 py-2 pl-5 rounded-(--radius) bg-(--card) border-2 border-(--accent)/55 text-(--text) placeholder:text-(--text)/60 transition-all duration-300 ease focus:outline-none focus:ring-0 focus:shadow-none focus:border-(--accent)"
                   type="text"
                   placeholder="Search"
                   aria-label="Search projects"
            />

            <div className="py-6 gap-10 justify-between items-stretch mt-6 grid grid-cols-3">

                {/*<div className="bg-white pb-4 flex flex-col items-center">*/}
                {/*    <img src={Drone} className="" />*/}
                {/*    <h1 className="text-2xl mt-2 mb-1">Drone Project</h1>*/}
                {/*    <p>lorem ipsum eajsngsjankgdaksgdjkgnsa</p>*/}
                {/*</div>*/}

                {/*<div className="bg-white pb-4 flex flex-col items-center">*/}
                {/*    <img src={Drone} className="" />*/}
                {/*    <h1 className="text-2xl mt-2 mb-1">Drone Project</h1>*/}
                {/*    <p>lorem ipsum eajsngsjankgdaksgdjkgnsa</p>*/}
                {/*</div>*/}


                {/*<div className="bg-white pb-4 flex flex-col items-center">*/}
                {/*    <img src={Drone} className="" />*/}
                {/*    <h1 className="text-2xl mt-2 mb-1 text-center">Drone Project</h1>*/}
                {/*    <p className="text-center">lorem ipsuma eajsngsjankgdaksgdjkgnsa</p>*/}
                {/*</div>*/}

            </div>
        </AppShell>
    )
}