import Navbar from "../components/Navbar.jsx";

export default function Home() {
    return (
        <div className="min-h-screen bg-[#0B0C10]">
            <div className="fixed inset-0 z-0 bg-[#0B0C10] [background-image:linear-gradient(#FFB70330_1px,transparent_1px),linear-gradient(90deg,#FFB70330_1px,transparent_1px)] [background-size:55px_55px]" />
            <div className="fixed inset-0 z-0 bg-black/20 opacity-20" />

            <div className="relative z-10 grid grid-cols-[clamp(6rem,18vw,18rem)_minmax(0,1fr)] gap-6 px-10 md:px-10 py-14">

                <Navbar />
            </div>
        </div>
    )
}