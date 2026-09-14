import Navbar from "../components/Navbar.jsx";

export default function Home() {
    return (
        <div className="min-h-screen bg-[#0B0C10]">
            <div className="fixed inset-0 z-0 bg-[#0B0C10] [background-image:linear-gradient(#FFB70330_1px,transparent_1px),linear-gradient(90deg,#FFB70330_1px,transparent_1px)] [background-size:55px_55px]" />
            <div className="fixed inset-0 z-0 bg-black/20 opacity-20" />

            <div className="relative z-10 grid grid-cols-[clamp(6rem,18vw,18rem)_minmax(0,1fr)] gap-6 px-10 md:px-10 py-14">

                <Navbar />

                <main className="py-10 col-start-2 min-w-0">
                    <div className="mx-auto w-full max-w-6xl p-4">
                        <h1 className=" text-2xl md:text-6xl text-[#FFB703]">Dashboard</h1>
                        <div className="space-y-4 px-12 py-6 bg-[#25282A] rounded-xl min-h-72 md:min-h-84 h-full relative flex flex-col mt-10">
                            <div>
                                <h1 className="text-[#FFB703] text-4xl">Your Projects</h1>
                            </div>
                            <div className=" flex flex-col items-center justify-center text-center grow space-y-4 md:space-y-6">
                                <p className="text-[#FFB703] text-2xl">No Current Projects</p>
                                <button className="bg-[#FFB703] px-11 py-2.5 rounded-xl text-xl text-[#25282A] transition-all duration-300 ease hover:opacity-75">+ Add Project</button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}