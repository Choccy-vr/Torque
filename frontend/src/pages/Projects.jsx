import Navbar from "../components/Navbar.jsx";

export default function Home() {
    return (
        <div className="min-h-screen bg-(--bg)">
            <div className="t-bg fixed inset-0 z-0" />
            <div className="fixed inset-0 z-0 bg-black/20 opacity-(--overlay)" />

            <div className="relative z-10 grid grid-cols-[clamp(6rem,18vw,18rem)_minmax(0,1fr)] gap-6 px-10 md:px-10 py-14">

                <Navbar />
            </div>
        </div>
    )
}