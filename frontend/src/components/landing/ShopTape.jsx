import { useState } from "react";
import { Link } from "react-router-dom";
import { Pause, Play, Zap } from "lucide-react";
import { ItemImage } from "../shop/ShopParts.jsx";
import { getShopMarquee } from "../../lib/endpoints.js";
import { useApi } from "../../lib/useApi.js";

// Enough items per loop that one copy of a band outruns a wide screen.
const MIN_PER_LOOP = 14;
// Seconds each item takes to cross, so a short list doesn't race.
const SECONDS_PER_ITEM = 4;

// Landing: what's in the shop, on two bands crossed into an X that slide in
// opposite directions. Real items only; with none (pre-launch, or the request
// fails) the section isn't drawn at all.
export default function ShopTape() {
    const { data: items } = useApi(getShopMarquee);
    const [paused, setPaused] = useState(false);

    if (!items?.length) return null;

    const loop = Array.from({ length: Math.ceil(MIN_PER_LOOP / items.length) }, () => items).flat();
    const speed = `${loop.length * SECONDS_PER_ITEM}s`;
    // The second band starts halfway through the list, so the crossing never shows the same item twice.
    const shifted = [...loop.slice(Math.floor(loop.length / 2)), ...loop.slice(0, Math.floor(loop.length / 2))];

    return (
        <section id="shop" aria-labelledby="shop-title" className="relative z-20 w-full overflow-hidden py-20 md:py-28">
            <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-6 text-center">
                <h2 id="shop-title" className="t-heading text-4xl font-bold md:text-6xl">In the Shop</h2>
                <p className="max-w-[48ch] text-lg leading-relaxed text-pretty text-(--text)/85 md:text-xl">
                    Spend the Volts you earn on parts and prizes. Every level you ship unlocks more, and one random item is up for grabs each day.
                </p>
            </div>

            <ul className="sr-only">
                {items.map((item, i) => <li key={i}>{item.name}, Level {item.tier}</li>)}
            </ul>

            <div
                aria-hidden="true"
                data-paused={paused || undefined}
                className="t-tape relative mt-8 h-72 md:mt-10 md:h-80"
                style={{ "--t-tape-speed": speed }}
            >
                <Band items={shifted} className="top-[36%] sm:top-1/2 -rotate-[14deg] sm:-rotate-[7deg] lg:-rotate-[5deg] border-(--accent)/55 bg-(--card) text-(--text)" reverse />
                <Band items={loop} className="top-[64%] sm:top-1/2 rotate-[14deg] sm:rotate-[7deg] lg:rotate-[5deg] border-(--btn-text) bg-(--accent) text-(--btn-text)" coral />
            </div>

            <div className="mx-auto mt-6 flex max-w-(--breakpoint-2xl) flex-col-reverse items-center gap-4 px-6 sm:flex-row sm:justify-between sm:px-10 lg:px-20">
                <Link
                    to="/docs/rewards"
                    className="inline-flex min-h-11 items-center rounded-(--radius) border-2 border-(--accent)/55 px-8 font-bold text-(--text) transition-all duration-300 ease hover:border-(--accent) hover:bg-(--accent)/15"
                >
                    How rewards work
                </Link>
                <button
                    type="button"
                    onClick={() => setPaused((p) => !p)}
                    aria-pressed={paused}
                    className="inline-flex min-h-11 items-center gap-2 rounded-(--radius) px-4 text-sm font-medium text-(--text)/85 transition-all duration-300 ease hover:bg-white/10 hover:text-(--text) motion-reduce:hidden"
                >
                    {paused ? <Play aria-hidden="true" className="size-4" /> : <Pause aria-hidden="true" className="size-4" />}
                    {paused ? "Play the shop tape" : "Pause the shop tape"}
                </button>
            </div>
        </section>
    );
}

// One full-bleed band, rotated about its own centre (`className` sets where
// that sits: the middle, or pulled apart on phones so the bands cross nearer
// the edges and both stay readable). Its track
// holds the loop twice so sliding one copy's width wraps seamlessly.
function Band({ items, className, reverse = false, coral = false }) {
    return (
        <div className={`absolute left-1/2 w-[130vw] -translate-x-1/2 -translate-y-1/2 overflow-hidden border-y-2 ${className}`}>
            <div className="t-tape-track flex w-max" data-reverse={reverse || undefined}>
                {[0, 1].map((copy) => (
                    <div key={copy} className="flex shrink-0">
                        {items.map((item, i) => <Piece key={i} item={item} coral={coral} />)}
                    </div>
                ))}
            </div>
        </div>
    );
}

function Piece({ item, coral }) {
    return (
        <div className="flex h-16 shrink-0 items-center gap-3 pr-6 pl-2 md:h-20">
            <ItemImage
                src={item.imageUrl}
                className={`size-10 rounded-[0.75rem] border-2 md:size-14 ${coral ? "border-(--btn-text)/70" : "border-white/20"}`}
            />
            <span className="max-w-[28ch] truncate text-lg font-bold md:text-xl">{item.name}</span>
            <span className={`rounded-full border-2 px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap ${coral ? "border-(--btn-text)/60" : "border-white/25 text-(--text)/85"}`}>
                Level {item.tier}
            </span>
            <Zap aria-hidden="true" className={`ml-4 size-5 shrink-0 ${coral ? "text-(--btn-text)" : "text-(--accent)"}`} strokeWidth={2.5} />
        </div>
    );
}
