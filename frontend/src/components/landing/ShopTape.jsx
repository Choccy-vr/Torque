import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { ItemImage, Volts } from "../shop/ShopParts.jsx";
import { getShopMarquee } from "../../lib/endpoints.js";
import { useApi } from "../../lib/useApi.js";

// Enough items per loop that one copy of a band outruns a wide screen.
const MIN_PER_LOOP = 16;
// Seconds each item takes to cross, so a short list doesn't race and there's
// time to read a card.
const SECONDS_PER_ITEM = 5;

// Landing: what's in the shop, as shop cards riding two bands crossed into an
// X that slide in opposite directions. Real items only; with none (pre-launch, or the request
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
                {items.map((item, i) => (
                    <li key={i}>{item.name}, Level {item.tier}, {item.hasOptions ? "from " : ""}{item.price.toLocaleString()} Volts</li>
                ))}
            </ul>

            <div
                aria-hidden="true"
                data-paused={paused || undefined}
                className="t-tape relative mt-8 h-[46rem] sm:h-[48rem] md:mt-10 xl:h-[38rem]"
                style={{ "--t-tape-speed": speed }}
            >
                <Band items={shifted} className="top-1/4 -rotate-[6deg] sm:-rotate-[4deg] xl:top-1/2 xl:-rotate-[11deg] border-(--accent)/55 bg-(--bg)" reverse />
                <Band items={loop} className="top-3/4 rotate-[6deg] sm:rotate-[4deg] xl:top-1/2 xl:rotate-[11deg] border-(--btn-text) bg-(--accent)" coral />
            </div>

            <div className="mt-6 flex justify-center px-6">
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
// that sits: the middle on wide screens, crossed steeply enough that the
// back band shows past the front one; pulled apart below that, where the
// cards are too tall for both to stay readable on a crossing). Its track
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

// A compact shop card (the /shop product card without its Get button, since
// visitors aren't signed in): photo tagged with its level, name, two lines
// of description, then the base price. Cards look the same on both bands.
function Piece({ item, coral }) {
    return (
        <div className="py-3 pr-3">
            <article className={`t-card flex h-full w-44 flex-col overflow-hidden text-(--text)! md:w-48 ${coral ? "border-(--btn-text)/70!" : ""}`}>
                <div className="relative">
                    <ItemImage src={item.imageUrl} className="aspect-[4/3] w-full border-b-2 border-(--accent)/35 p-3" />
                    <span className="absolute top-2.5 left-2.5 rounded-full border border-white/20 bg-(--card) px-2.5 py-0.5 text-[0.8125rem] font-medium whitespace-nowrap">
                        Level {item.tier}
                    </span>
                </div>
                <div className="flex flex-1 flex-col gap-1 px-4 pt-3 pb-4">
                    <h3 className="line-clamp-2 leading-snug font-semibold text-balance break-words">{item.name}</h3>
                    {item.description && <p className="line-clamp-2 text-sm leading-relaxed text-(--text)/80">{item.description}</p>}
                    <p className="mt-auto flex items-baseline gap-1.5 pt-2">
                        {item.hasOptions && <span className="text-sm text-(--text)/80">From</span>}
                        <Volts amount={item.price} size="text-lg" />
                    </p>
                </div>
            </article>
        </div>
    );
}
