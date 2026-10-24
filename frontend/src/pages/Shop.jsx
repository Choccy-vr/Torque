import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarX, ChevronLeft, ChevronRight, Hourglass, Lock, PackageCheck, Timer, Undo2, Zap } from "lucide-react";
import AppShell, { PageHeader } from "../components/AppShell.jsx";
import { Empty, InlineError, Notice, PageButton, PauseNotices, Section } from "../components/PageParts.jsx";
import { BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, FOCUS, FormError } from "../components/Form.jsx";
import { ConfirmBox, Tag } from "../components/admin/AdminParts.jsx";
import CheckoutDialog from "../components/shop/CheckoutDialog.jsx";
import { ItemImage, Volts } from "../components/shop/ShopParts.jsx";
import { cancelShopOrder, clearMyProfile, getMyShopOrders, getShop } from "../lib/endpoints.js";
import { errorText } from "../lib/forms.js";
import { formatDay, lastDay, LEVELS } from "../lib/projects.js";
import { PAUSE, pausedMessage, useSettings } from "../lib/settings.js";
import { ORDER_STATUS, REASON_LABEL, regionName, stockText, useCountdown } from "../lib/shop.js";
import { useApi } from "../lib/useApi.js";
import { useScrollEdges } from "../lib/useScrollEdges.js";

// Why nothing can be bought right now beyond an admin pause: the shop has
// closed for good (see ShopClosing). Null while it's open.
const ShopClosed = createContext(null);

// How long before the shop closes its last-week notice shows.
const CLOSING_SOON_MS = 7 * 24 * 60 * 60 * 1000;

// /shop — spend Volts. Today's random item as the featured card, then one
// sideways shelf of prize cards per level (1–4), unlocked by the highest level
// among your approved ships. Then your orders.
export default function Shop() {
    const shop = useApi(getShop);
    const orders = useApi(getMyShopOrders);
    const [buying, setBuying] = useState(null); // { item, isDaily }

    const ordered = useCallback(() => {
        clearMyProfile();
        shop.reload();
        orders.reload();
    }, [shop, orders]);

    const closedMessage = shop.data?.closed ? `The shop closed on ${lastDay(shop.data.closesAt)}.` : null;

    return (
        <AppShell title="Shop">
            <ShopClosed.Provider value={closedMessage}>
                <PageHeader
                    title="Shop"
                    lede="Spend your Volts on parts and prizes. Shipping an approved project unlocks its level and every level below it."
                >
                    {shop.data && (
                        <div className="flex flex-col items-start gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
                            <Ledger shop={shop.data} />
                            {shop.data.unlockedTier === 0 && (
                                <Link
                                    to="/docs/rewards"
                                    className={`-ml-3 inline-flex min-h-11 items-center rounded-(--radius) px-3 font-medium text-(--text) underline decoration-(--accent) decoration-2 underline-offset-4 transition-all duration-300 ease hover:bg-white/10 sm:ml-0 ${FOCUS}`}
                                >
                                    How to earn Volts and unlock levels
                                </Link>
                            )}
                        </div>
                    )}
                </PageHeader>

                {shop.data && <ShopClosing shop={shop.data} />}
                <PauseNotices keys={[PAUSE.shop]} className="mt-6" />

                <div className="mt-10 flex flex-col gap-12">
                    {shop.loading && !shop.data ? (
                        <ShopSkeleton />
                    ) : shop.error ? (
                        <InlineError what="the shop" onRetry={shop.reload} />
                    ) : (
                        <Catalogue shop={shop.data} onBuy={setBuying} onRotated={shop.reload} />
                    )}

                    <YourOrders orders={orders} onChanged={ordered} />
                </div>

                {buying && (
                    <CheckoutDialog
                        item={buying.item}
                        isDaily={buying.isDaily}
                        volts={shop.data.volts}
                        onOrdered={ordered}
                        onClose={() => setBuying(null)}
                    />
                )}
            </ShopClosed.Provider>
        </AppShell>
    );
}

// The shop's end (US Eastern): a notice through its last week, then one saying
// it has closed. Orders already placed still get fulfilled.
function ShopClosing({ shop }) {
    // Read once per visit; the closed state itself comes from the server.
    const [now] = useState(() => Date.now());
    const day = lastDay(shop.closesAt);
    if (shop.closed) {
        return (
            <div className="mt-6">
                <Notice icon={CalendarX}>
                    <b className="font-bold text-(--text)">The shop has closed.</b> The last day to order was {day}. Orders you've already placed still ship.
                </Notice>
            </div>
        );
    }
    if (new Date(shop.closesAt).getTime() - now > CLOSING_SOON_MS) return null;
    return (
        <div className="mt-6">
            <Notice icon={Hourglass}>
                <b className="font-bold text-(--text)">Last week to order.</b> The shop closes after {day} (US Eastern), so spend your Volts before then.
            </Notice>
        </div>
    );
}

// Balance, unlocked level and region, as a strip of ruled cells.
function Ledger({ shop }) {
    const cells = [
        ["Your Volts", <Volts key="v" amount={shop.volts} />],
        ["Unlocked", shop.unlockedTier > 0 ? `Level ${shop.unlockedTier} and below` : "Nothing yet"],
        ["Your region", regionName(shop.region)],
    ];
    return (
        <dl className="grid grid-cols-1 overflow-hidden rounded-2xl border-2 border-white/15 bg-(--card) sm:inline-grid sm:grid-cols-3">
            {cells.map(([label, value]) => (
                <div key={label} className="-mt-0.5 -ml-0.5 flex min-w-0 flex-col-reverse gap-0.5 border-t-2 border-l-2 border-white/15 px-4 py-3 sm:min-w-44">
                    <dt className="text-sm text-(--text)/75">{label}</dt>
                    <dd className="text-lg font-semibold text-(--text) tabular-nums">{value}</dd>
                </div>
            ))}
        </dl>
    );
}

function Catalogue({ shop, onBuy, onRotated }) {
    const empty = !shop.daily && shop.tiers.every((t) => t.items.length === 0);
    if (empty) {
        return (
            <Empty title="The shop is still being stocked">
                Motors, drivers and other prizes land here soon. Keep building: the Volts you earn now are waiting for them.
            </Empty>
        );
    }

    return (
        <>
            {/* A closed shop has no "today" left to count down to. */}
            {shop.daily && !shop.closed && <DailyItem daily={shop.daily} onBuy={onBuy} onRotated={onRotated} />}
            {shop.tiers.map((tier) => (
                <LevelSection key={tier.tier} tier={tier} dailyId={shop.closed ? null : shop.daily?.item.id} volts={shop.volts} onBuy={onBuy} />
            ))}
        </>
    );
}

// Today's random item as the featured line: any level can get it until 12 AM
// US Eastern, when it rotates (and the page reloads to show the next one).
function DailyItem({ daily, onBuy, onRotated }) {
    const { item } = daily;
    const countdown = useCountdown(daily.endsAt, onRotated);

    return (
        <Section
            id="daily-heading"
            title="Random item of the day"
            action={
                <p className="inline-flex items-center gap-2 text-(--text)/85">
                    <Timer aria-hidden="true" className="size-5" />
                    <span>
                        Changes in{" "}
                        <span aria-hidden="true" className="font-semibold text-(--text) tabular-nums">{countdown.text}</span>
                        <span className="sr-only">{countdown.label}</span>
                    </span>
                </p>
            }
        >
            <article
                aria-labelledby="daily-name"
                className={`t-card grid grid-cols-1 overflow-hidden text-(--text)! ${item.imageUrl ? "sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" : ""}`}
            >
                {/* No photo: the line takes the whole card rather than spending it on a placeholder. */}
                {item.imageUrl && (
                    <ItemImage src={item.imageUrl} className="aspect-[4/3] w-full border-b-2 border-(--accent)/55 p-4 sm:h-full sm:border-r-2 sm:border-b-0" />
                )}
                <div className="flex flex-col gap-4 px-5 py-6 sm:px-8 sm:py-8">
                    <div className="flex flex-wrap gap-2">
                        <Tag>Level {item.tier}</Tag>
                        <Tag>{item.randomMode === "random_only" ? "Only as the random item" : "Any level today"}</Tag>
                    </div>
                    <h3 id="daily-name" className="text-3xl leading-tight font-bold text-balance break-words">{item.name}</h3>
                    {item.description && <p className="max-w-[60ch] leading-relaxed text-(--text)/90">{item.description}</p>}
                    {item.variants.length > 0 && (
                        <p className="text-sm text-(--text)/80">
                            {item.variants.length} options: {item.variants.map((v) => v.name).join(", ")}
                        </p>
                    )}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-x-6 gap-y-4 pt-2">
                        <div className="flex flex-col gap-0.5">
                            <Volts amount={item.price} size="text-3xl" muted={Boolean(item.unavailableReason) && item.unavailableReason !== "insufficient_volts"} />
                            <span className="text-sm text-(--text)/75">
                                {[item.variants.length > 0 && "From this price", stockText(item.stock)].filter(Boolean).join(" · ") || "Price for your region"}
                            </span>
                        </div>
                        <BuyButton item={item} label="Get it today" onBuy={() => onBuy({ item, isDaily: true })} large />
                    </div>
                </div>
            </article>
        </Section>
    );
}

// Card widths: a peek of the next card on phones, four-ish across a laptop.
const CARD_W = "w-[min(16.5rem,calc(100vw-5rem))] sm:w-64 lg:w-[17rem]";

// The shelf scrolls sideways under its heading. On phones it bleeds to the
// screen edge (the page's own padding becomes scroll padding) so cards slide
// out of view instead of being cut at the gutter.
const SHELF = "t-scroll -mx-4 flex snap-x gap-4 overflow-x-auto scroll-px-4 px-4 pt-1 pb-3 outline-none focus-visible:ring-2 focus-visible:ring-(--text) sm:-mx-6 sm:scroll-px-6 sm:px-6 md:mx-0 md:scroll-px-0 md:px-0 md:focus-within:[mask-image:none]";

// Fades whichever end of a shelf has more cards past it (md+, where the row
// stops at the content column instead of the screen edge).
const fade = ({ start, end }) =>
    start && end
        ? "md:[mask-image:linear-gradient(to_right,transparent,black_3rem,black_calc(100%-3rem),transparent)]"
        : end
            ? "md:[mask-image:linear-gradient(to_right,black_calc(100%-3rem),transparent)]"
            : start
                ? "md:[mask-image:linear-gradient(to_right,transparent,black_3rem)]"
                : "";

// One level's shelf: a single row of product cards that scrolls sideways,
// with ‹ › buttons once it overflows. Locked levels still show what's on them,
// drawn neutral, with what unlocks them.
function LevelSection({ tier, dailyId, volts, onBuy }) {
    const level = LEVELS.find((l) => l.level === tier.tier);
    const id = `level-${tier.tier}`;
    const rowRef = useRef(null);
    const edges = useScrollEdges(rowRef, tier.items);

    const page = (direction) => {
        const row = rowRef.current;
        const smooth = window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
        row.scrollBy({ left: direction * row.clientWidth * 0.9, behavior: smooth ? "smooth" : "auto" });
    };

    return (
        <Section
            id={`${id}-heading`}
            title={`Level ${tier.tier}${level ? ` · ${level.name}` : ""}`}
            count={tier.items.length}
            action={(!tier.unlocked || edges.start || edges.end) && (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    {!tier.unlocked && (
                        <p className="inline-flex items-center gap-2 text-(--text)/85">
                            <Lock aria-hidden="true" className="size-4.5" />
                            Ship an approved Level {tier.tier} project to unlock
                        </p>
                    )}
                    {(edges.start || edges.end) && (
                        <div className="hidden gap-2 sm:flex">
                            <PageButton icon={ChevronLeft} label={`Earlier Level ${tier.tier} prizes`} controls={`${id}-row`} disabled={!edges.start} onClick={() => page(-1)} />
                            <PageButton icon={ChevronRight} label={`More Level ${tier.tier} prizes`} controls={`${id}-row`} disabled={!edges.end} onClick={() => page(1)} />
                        </div>
                    )}
                </div>
            )}
        >
            {tier.items.length === 0 ? (
                <p className="rounded-[var(--card-radius)] border-2 border-dashed border-white/20 px-5 py-5 leading-relaxed text-(--text)/80 sm:px-7">
                    Nothing at Level {tier.tier} yet.
                </p>
            ) : (
                <ul ref={rowRef} id={`${id}-row`} tabIndex={0} aria-labelledby={`${id}-heading`} className={`${SHELF} ${fade(edges)}`}>
                    {tier.items.map((item) => (
                        <ProductCard
                            key={item.id}
                            item={item}
                            volts={volts}
                            // Today's random item is buyable at any level, so it isn't drawn locked.
                            locked={!tier.unlocked && item.id !== dailyId}
                            isDaily={item.id === dailyId}
                            onBuy={onBuy}
                        />
                    ))}
                </ul>
            )}
        </Section>
    );
}

// One prize as a shop card: photo, name, a short description, its options,
// price and stock, then Get. A card you can buy is one click target (the Get
// button stretches over it) and lifts on hover; one you can't says why.
// Locked cards are drawn neutral, dimmed by colour so text still clears 4.5:1.
function ProductCard({ item, volts, locked, isDaily, onBuy }) {
    const tone = locked ? "text-(--text)/75" : "";
    const muted = Boolean(item.unavailableReason) && item.unavailableReason !== "insufficient_volts";
    const buyable = !item.unavailableReason;
    const stock = item.variants.length > 0
        ? item.variants.some((v) => v.stock == null)
            ? null
            : item.variants.reduce((sum, v) => sum + Math.max(0, v.stock), 0)
        : item.stock;
    // Why it can't be bought, spelled out (the label alone says what, not how much).
    const why = item.unavailableReason === "insufficient_volts"
        ? `You need ${(item.price - volts).toLocaleString()} more Volts.`
        : item.unavailableReason === "limit_reached"
            ? item.unavailableMessage
            : null;

    return (
        <li
            // A focused card that's partly out of the shelf scrolls in. It's
            // aligned to its own start, because a "nearest" nudge is smaller
            // than the gap to the next snap point and gets snapped straight back.
            onFocus={(e) => {
                const c = e.currentTarget.getBoundingClientRect();
                const r = e.currentTarget.parentElement.getBoundingClientRect();
                if (c.left < r.left || c.right > r.right) e.currentTarget.scrollIntoView({ inline: "start", block: "nearest" });
            }}
            className={`t-card relative flex ${CARD_W} shrink-0 snap-start flex-col overflow-hidden text-(--text)! ${
                locked || !buyable
                    ? "border-white/15!"
                    : buyable
                        ? // `!`: .t-card sets its border outside Tailwind's layers, so plain utilities lose to it.
                        "has-[button:hover]:-translate-y-0.5 has-[button:hover]:border-(--accent)! has-[button:focus-visible]:border-(--accent)! motion-reduce:has-[button:hover]:translate-y-0"
                        : ""
            }`}
        >
            <div className="relative">
                <ItemImage
                    src={item.imageUrl}
                    className={`aspect-[4/3] w-full border-b-2 p-3 ${locked ? "border-white/10 opacity-40" : buyable ? "border-(--accent)/35" : "border-white/10"}`}
                />
                {isDaily && (
                    <span className="absolute top-3 left-3 rounded-full bg-(--card)">
                        <Tag>Random item today</Tag>
                    </span>
                )}
            </div>
            <div className="flex flex-1 flex-col gap-1.5 px-5 pt-4 pb-5">
                <h3 className={`line-clamp-2 text-lg leading-snug font-semibold text-balance break-words ${tone}`}>{item.name}</h3>
                {item.description && <p className="line-clamp-2 text-sm leading-relaxed text-(--text)/80">{item.description}</p>}
                {item.variants.length > 0 && (
                    <p className="line-clamp-1 text-sm text-(--text)/80">
                        <span className="sr-only">Options: </span>
                        {item.variants.length > 2 ? `${item.variants.length} options` : item.variants.map((v) => v.name).join(" · ")}
                    </p>
                )}
                <div className="mt-auto flex flex-col gap-3 pt-3">
                    <p className={`flex flex-wrap items-baseline gap-x-2 ${tone}`}>
                        {item.variants.length > 0 && <span className="text-sm text-(--text)/80">From</span>}
                        <Volts amount={item.price} size="text-xl" muted={muted} />
                        {stockText(stock) && <span className="text-sm text-(--text)/75 tabular-nums">{stockText(stock)}</span>}
                    </p>
                    <div className="flex flex-col">
                        <BuyButton item={item} onBuy={() => onBuy({ item, isDaily })} stretch />
                        {why && <p className="-mt-1 text-sm leading-snug text-(--text)/80">{why}</p>}
                    </div>
                </div>
            </div>
        </li>
    );
}

// "Get" when it can be bought, otherwise why not (the full reason as its
// description). A locked level reads as Locked rather than a sale button.
// `stretch` makes the button's hit area cover its whole card.
function BuyButton({ item, label = "Get", onBuy, large = false, stretch = false }) {
    const closed = useContext(ShopClosed);
    const paused = pausedMessage(useSettings(), PAUSE.shop) ?? closed;
    const reason = item.unavailableReason;

    if (reason) {
        return (
            <p className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-(--text)/85">
                {reason === "locked_tier" && <Lock aria-hidden="true" className="size-4" />}
                <span>{REASON_LABEL[reason] ?? "Unavailable"}</span>
                <span className="sr-only">: {item.unavailableMessage}</span>
            </p>
        );
    }

    return (
        <button
            type="button"
            onClick={paused ? undefined : onBuy}
            aria-disabled={paused ? true : undefined}
            title={paused ?? undefined}
            aria-haspopup="dialog"
            className={`${large ? `${BTN_PRIMARY} px-8 text-lg` : `${BTN_OUTLINE} w-full`} ${
                stretch ? "after:absolute after:inset-0 after:rounded-[var(--card-radius)] after:content-['']" : ""
            } aria-disabled:pointer-events-none aria-disabled:border-white/15 aria-disabled:bg-white/10 aria-disabled:text-(--text)/75`}
        >
            {label}
            <span className="sr-only">: {item.name}</span>
        </button>
    );
}

function YourOrders({ orders, onChanged }) {
    return (
        <Section id="orders-heading" title="Your orders" count={orders.data?.length}>
            {orders.loading && !orders.data ? (
                <div aria-busy="true" aria-label="Loading your orders" className="t-card h-28 motion-safe:animate-pulse text-(--text)!" />
            ) : orders.error ? (
                <InlineError what="your orders" onRetry={orders.reload} />
            ) : orders.data.length === 0 ? (
                <Empty title="No orders yet">
                    Anything you get from the shop shows up here, from the moment you order it until it ships.
                </Empty>
            ) : (
                <ul aria-labelledby="orders-heading" className="t-card divide-y-2 divide-white/10 overflow-hidden text-(--text)!">
                    {orders.data.map((order) => <OrderLine key={order.id} order={order} onChanged={onChanged} />)}
                </ul>
            )}
        </Section>
    );
}

function OrderLine({ order, onChanged }) {
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    async function cancel() {
        setBusy(true);
        setError(null);
        try {
            await cancelShopOrder(order.id);
            setConfirming(false);
            onChanged();
        } catch (err) {
            setError(errorText(err));
        } finally {
            setBusy(false);
        }
    }

    return (
        <li className="flex flex-col gap-4 px-5 py-4 sm:px-6">
            <div className="flex items-start gap-4">
                <ItemImage src={order.imageUrl} className="size-12 rounded-xl border-2 border-white/15" />
                <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-5">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <p className="font-semibold break-words">
                            {order.quantity > 1 && <span className="tabular-nums">{order.quantity}× </span>}
                            {order.itemName}
                            {order.variantName && <span className="font-normal text-(--text)/85"> · {order.variantName}</span>}
                        </p>
                        <p className="text-sm text-(--text)/80 tabular-nums">
                            Ordered {formatDay(order.createdAt)} · {order.totalPrice.toLocaleString()} Volts
                            {order.status === "fulfilled" && order.fulfilledAt && ` · shipped ${formatDay(order.fulfilledAt)}`}
                            {order.status === "refunded" && " · Volts returned"}
                        </p>
                        {order.trackingReference && (
                            <p className="text-sm break-all text-(--text)/90">
                                Tracking: <span className="font-medium select-all">{order.trackingReference}</span>
                            </p>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Tag accent={order.status === "fulfilled"}>
                            {order.status === "fulfilled" && <PackageCheck aria-hidden="true" className="size-3.5" />}
                            {ORDER_STATUS[order.status]}
                        </Tag>
                        {order.status === "pending" && !confirming && (
                            <button type="button" onClick={() => setConfirming(true)} className={`${BTN_GHOST} min-h-10 px-4 text-sm`}>
                                <Undo2 aria-hidden="true" className="size-4" />
                                Cancel
                            </button>
                        )}
                    </div>
                </div>
            </div>
            {confirming && (
                <ConfirmBox
                    id={`cancel-${order.id}`}
                    title="Cancel this order?"
                    confirmLabel="Cancel order"
                    busyLabel="Cancelling…"
                    icon={Undo2}
                    busy={busy}
                    onConfirm={cancel}
                    onCancel={() => setConfirming(false)}
                >
                    <span className="inline-flex flex-wrap items-center gap-1">
                        <Zap aria-hidden="true" className="size-4 text-(--accent)" />
                        {order.totalPrice.toLocaleString()} Volts go straight back to your balance.
                    </span>
                </ConfirmBox>
            )}
            <FormError>{error}</FormError>
        </li>
    );
}

function ShopSkeleton() {
    return (
        <div aria-busy="true" aria-label="Loading the shop" className="flex flex-col gap-12">
            <div className="t-card grid h-72 grid-cols-1 overflow-hidden text-(--text)! sm:grid-cols-[2fr_3fr]">
                <div className="bg-white/5 motion-safe:animate-pulse" />
                <div className="flex flex-col gap-3 p-8">
                    <div className="h-8 w-2/3 rounded-lg bg-white/10 motion-safe:animate-pulse" />
                    <div className="h-4 w-full rounded bg-white/10 motion-safe:animate-pulse" />
                    <div className="h-4 w-4/5 rounded bg-white/10 motion-safe:animate-pulse" />
                </div>
            </div>
            {[0, 1].map((i) => (
                <div key={i} className="flex flex-col gap-5">
                    <div className="h-9 w-56 rounded-lg bg-white/10 motion-safe:animate-pulse" />
                    <div className="flex gap-4 overflow-hidden">
                        {[0, 1, 2, 3].map((j) => (
                            <div key={j} className={`t-card flex ${CARD_W} shrink-0 flex-col overflow-hidden text-(--text)!`}>
                                <div className="aspect-[4/3] bg-white/5 motion-safe:animate-pulse" />
                                <div className="flex flex-col gap-2.5 p-5">
                                    <div className="h-5 w-4/5 rounded bg-white/10 motion-safe:animate-pulse" />
                                    <div className="h-4 w-full rounded bg-white/10 motion-safe:animate-pulse" />
                                    <div className="mt-3 h-11 w-full rounded-full bg-white/10 motion-safe:animate-pulse" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
