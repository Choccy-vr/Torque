import Navbar from "../components/Navbar.jsx";
import Drone from "../assets/drone.png";

export default function Home() {
    return (
        <div className="min-h-screen bg-[#0B0C10]">
            <div className="fixed inset-0 z-0 bg-[#0B0C10] [background-image:linear-gradient(#FFB70330_1px,transparent_1px),linear-gradient(90deg,#FFB70330_1px,transparent_1px)] [background-size:55px_55px]" />
            <div className="fixed inset-0 z-0 bg-black/20 opacity-20" />

            <div className="relative z-10 grid grid-cols-[clamp(6rem,18vw,18rem)_minmax(0,1fr)] gap-6 px-10 md:px-10 py-14">
                <Navbar />

                <main className="py-10 col-start-2 min-w-0">
                    <div className="mx-auto w-full max-w-6xl p-4">
                        <h1 className="text-white text-3xl md:text-6xl">Explore</h1>
                        <input className="w-full mt-6 py-2 pl-4 rounded-md bg-[#25282A] outline-none border-2 border-gray-700 text-white"
                               type="text"
                               placeholder="Search"
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
                    </div>
                </main>
            </div>
        </div>
    )
}