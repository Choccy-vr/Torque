import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CircleAlert, CircleCheck, ExternalLink, MapPin, Minus, Plus, RotateCw, X } from "lucide-react";
import { BTN_GHOST, BTN_PRIMARY, FOCUS, FieldError, FormError, INPUT } from "../Form.jsx";
import { ItemImage, Volts } from "./ShopParts.jsx";
import { getShopAddress, purchaseShopItem } from "../../lib/endpoints.js";
import { errorText } from "../../lib/forms.js";
import { PAUSE, pausedMessage, useSettings } from "../../lib/settings.js";
import { regionName, stockText } from "../../lib/shop.js";
import { useApi } from "../../lib/useApi.js";

const MAX_QUANTITY = 10;
const MAX_NOTE = 500;

// Buying one item, in a native modal dialog (it spends Volts and confirms where
// it ships, so it holds focus until it's done or dismissed). Pick an option and
// quantity, check the total against your balance, confirm your Hack Club Auth
// address, then order. The server prices it again; nothing here is trusted.
// `onOrdered(result)` runs after a successful order; `onClose` when it closes.
export default function CheckoutDialog({ item, volts, isDaily, onOrdered, onClose }) {
    const id = useId();
    const ref = useRef(null);
    const pressedBackdrop = useRef(false);
    // One per checkout, so a double submit or a retry can't buy twice.
    const [requestId] = useState(() => crypto.randomUUID());

    const variants = item.variants;
    const firstInStock = variants.find((v) => v.stock == null || v.stock > 0);
    const [variantId, setVariantId] = useState(firstInStock?.id ?? null);
    const variant = variants.find((v) => v.id === variantId) ?? null;
    const [quantity, setQuantity] = useState(1);
    const [confirmed, setConfirmed] = useState(false);
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [done, setDone] = useState(null);

    const fetchAddress = useCallback(() => getShopAddress(), []);
    const address = useApi(fetchAddress);
    const paused = pausedMessage(useSettings(), PAUSE.shop);

    useEffect(() => {
        if (!ref.current.open) ref.current.showModal();
    }, []);
    const close = () => ref.current?.close();

    const unitPrice = variant ? variant.price : item.price;
    const stock = variant ? variant.stock : item.stock;
    const ownedRoom = item.maxPerUser == null ? Infinity : item.maxPerUser - item.owned;
    const maxQuantity = Math.max(1, Math.min(MAX_QUANTITY, stock ?? Infinity, ownedRoom));
    const total = unitPrice * quantity;
    const after = volts - total;
    const hasAddress = Boolean(address.data?.address);
    const [confirmError, setConfirmError] = useState(null);

    // What still stops the order, said beside the button instead of greying it out.
    const blocker = paused
        ? paused
        : variants.length > 0 && !variant
            ? "Pick an option first."
            : address.loading
                ? "Checking your address…"
                : !hasAddress
                    ? "Add a shipping address on Hack Club Auth first."
                    : after < 0
                        ? `You're ${(-after).toLocaleString()} Volts short.`
                        : null;

    async function submit(e) {
        e.preventDefault();
        if (busy || blocker) return;
        if (!confirmed) {
            setConfirmError("Tick this to confirm where it ships.");
            document.getElementById(`${id}-confirm`)?.focus();
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const result = await purchaseShopItem({
                itemId: item.id,
                variantId: variant?.id ?? null,
                quantity,
                addressConfirmed: true,
                note: note.trim() || null,
                clientRequestId: requestId,
            });
            setDone(result);
            onOrdered(result);
        } catch (err) {
            setError(errorText(err, "Your order didn't go through. Check your connection and try again."));
        } finally {
            setBusy(false);
        }
    }

    return (
        <dialog
            ref={ref}
            aria-labelledby={`${id}-title`}
            onClose={onClose}
            onPointerDown={(e) => { pressedBackdrop.current = e.target === e.currentTarget; }}
            onClick={(e) => pressedBackdrop.current && e.target === e.currentTarget && !busy && close()}
            onCancel={(e) => busy && e.preventDefault()}
            className="t-card t-scroll m-auto max-h-[min(90vh,52rem)] w-[min(38rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain p-0 text-(--text)! backdrop:bg-black/60"
        >
            <div className="sticky top-0 z-10 flex justify-end bg-(--card) py-2 pr-2 sm:pr-4">
                <button
                    type="button"
                    onClick={close}
                    disabled={busy}
                    aria-label="Close"
                    className={`inline-flex size-11 shrink-0 items-center justify-center rounded-(--radius) text-(--text) transition-all duration-300 ease hover:bg-white/10 ${FOCUS}`}
                >
                    <X aria-hidden="true" className="size-5" />
                </button>
            </div>

            {done ? (
                <Ordered id={id} order={done.order} volts={done.volts} onDone={close} />
            ) : (
                <form onSubmit={submit} className="flex flex-col gap-6 px-5 pb-6 sm:px-8 sm:pb-8">
                    <div className="flex items-start gap-4">
                        <ItemImage src={item.imageUrl} className="size-20 rounded-[1.25rem] border-2 border-white/15 sm:size-24" />
                        <div className="flex min-w-0 flex-col gap-1">
                            <h2 id={`${id}-title`} className="text-2xl leading-tight font-bold text-balance break-words">{item.name}</h2>
                            {isDaily && <p className="text-sm text-(--text)/80">Random item of the day: any level can get it until midnight Eastern.</p>}
                            {item.description && <p className="line-clamp-3 leading-relaxed text-(--text)/85">{item.description}</p>}
                        </div>
                    </div>

                    {variants.length > 0 && (
                        <fieldset className="flex flex-col gap-2.5">
                            <legend className="mb-2.5 font-semibold">Option</legend>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {variants.map((v) => {
                                    const out = v.stock != null && v.stock <= 0;
                                    return (
                                        <label
                                            key={v.id}
                                            className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl border-2 px-4 py-2.5 transition-all duration-300 ease has-focus-visible:outline-2 has-focus-visible:outline-solid has-focus-visible:outline-offset-3 has-focus-visible:outline-(--text) ${
                                                out
                                                    ? "cursor-not-allowed border-white/10 text-(--text)/60"
                                                    : "cursor-pointer border-white/15 hover:border-white/30 hover:bg-white/10 has-checked:border-(--accent) has-checked:bg-(--accent)/15"
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name={`${id}-variant`}
                                                value={v.id}
                                                checked={variantId === v.id}
                                                disabled={out}
                                                onChange={() => { setVariantId(v.id); setQuantity(1); }}
                                                className="sr-only"
                                            />
                                            <span className="flex min-w-0 flex-col">
                                                <span className="font-semibold break-words">{v.name}</span>
                                                {stockText(v.stock) && <span className="text-sm text-(--text)/75">{stockText(v.stock)}</span>}
                                            </span>
                                            <Volts amount={v.price} muted={out} />
                                        </label>
                                    );
                                })}
                            </div>
                        </fieldset>
                    )}

                    {maxQuantity > 1 && (
                        <div className="flex items-center justify-between gap-4">
                            <span id={`${id}-qty`} className="font-semibold">Quantity</span>
                            <div role="group" aria-labelledby={`${id}-qty`} className="flex items-center gap-1 rounded-full border-2 border-white/15 p-1">
                                <button
                                    type="button"
                                    aria-label="One fewer"
                                    disabled={quantity <= 1}
                                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                    className={`inline-flex size-9 items-center justify-center rounded-full transition-colors duration-300 ease hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent ${FOCUS}`}
                                >
                                    <Minus aria-hidden="true" className="size-4" />
                                </button>
                                <output aria-live="polite" className="w-8 text-center font-semibold tabular-nums">{quantity}</output>
                                <button
                                    type="button"
                                    aria-label="One more"
                                    disabled={quantity >= maxQuantity}
                                    onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                                    className={`inline-flex size-9 items-center justify-center rounded-full transition-colors duration-300 ease hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent ${FOCUS}`}
                                >
                                    <Plus aria-hidden="true" className="size-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    <ShipTo
                        id={id}
                        address={address}
                        confirmed={confirmed}
                        error={confirmError}
                        onConfirm={(value) => { setConfirmed(value); setConfirmError(null); }}
                    />

                    <div className="flex flex-col gap-2">
                        <label htmlFor={`${id}-note`} className="font-semibold">
                            Note for whoever ships it <span className="font-normal text-(--text)/75">(optional)</span>
                        </label>
                        <textarea
                            id={`${id}-note`}
                            rows={2}
                            maxLength={MAX_NOTE}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className={`${INPUT} resize-y`}
                        />
                    </div>

                    {/* Stays in view while the form scrolls, so the total and the order button are always visible. */}
                    <div className="sticky bottom-0 -mx-5 -mb-6 flex flex-col gap-3 border-t-2 border-white/10 bg-(--card) px-5 pt-4 pb-5 sm:-mx-8 sm:-mb-8 sm:px-8 sm:pb-6">
                        <dl className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                            <div className="flex items-baseline gap-3">
                                <dt className="text-(--text)/85">Total{quantity > 1 && ` (${quantity} × ${unitPrice.toLocaleString()})`}</dt>
                                <dd><Volts amount={total} size="text-xl" /></dd>
                            </div>
                            <div className="flex items-baseline gap-2 text-sm">
                                <dt className="text-(--text)/80">Balance after</dt>
                                <dd className="font-semibold text-(--text)/90 tabular-nums">
                                    {after < 0 ? (
                                        <span className="inline-flex items-center gap-1.5 text-(--text)">
                                            <CircleAlert aria-hidden="true" className="size-4 self-center text-(--accent)" />
                                            {(-after).toLocaleString()} Volts short
                                        </span>
                                    ) : (
                                        `${after.toLocaleString()} Volts`
                                    )}
                                </dd>
                            </div>
                        </dl>
                        <FormError>{error}</FormError>
                        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
                            {blocker && <p role="status" className="text-sm leading-relaxed text-(--text)/85 sm:mr-auto">{blocker}</p>}
                            <button type="button" onClick={close} disabled={busy} className={BTN_GHOST}>Not now</button>
                            <button type="submit" disabled={busy || Boolean(blocker)} className={BTN_PRIMARY}>
                                {busy ? "Ordering…" : `Order for ${total.toLocaleString()} Volts`}
                            </button>
                        </div>
                    </div>
                </form>
            )}
        </dialog>
    );
}

// Where it ships: the address from Hack Club Auth, with a link to change it
// there and a checkbox the order can't go through without.
function ShipTo({ id, address, confirmed, error, onConfirm }) {
    const a = address.data?.address;

    return (
        <section aria-labelledby={`${id}-ship`} className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 id={`${id}-ship`} className="font-semibold">Ship to</h3>
                {address.data && (
                    <a
                        href={address.data.editUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`-mr-3 inline-flex min-h-11 items-center gap-1.5 rounded-(--radius) px-3 text-sm font-medium text-(--text) underline decoration-(--accent) decoration-2 underline-offset-4 transition-all duration-300 ease hover:bg-white/10 ${FOCUS}`}
                    >
                        {a ? "Change it on Hack Club Auth" : "Add one on Hack Club Auth"}
                        <ExternalLink aria-hidden="true" className="size-3.5" />
                        <span className="sr-only">(opens in a new tab)</span>
                    </a>
                )}
            </div>

            {address.loading ? (
                <div aria-busy="true" aria-label="Loading your address" className="flex flex-col gap-2 rounded-2xl border-2 border-white/15 bg-(--bg)/45 px-4 py-3.5">
                    {["w-40", "w-56", "w-32"].map((w) => <div key={w} className={`h-4 ${w} max-w-full rounded bg-white/10 motion-safe:animate-pulse`} />)}
                </div>
            ) : address.error ? (
                <div role="status" className="flex flex-col items-start gap-3 rounded-2xl border-2 border-dashed border-white/20 px-4 py-3.5">
                    <p className="leading-relaxed text-(--text)/90">{errorText(address.error, "Couldn't read your address from Hack Club Auth.")}</p>
                    <RecheckButton onClick={address.reload} label="Try again" />
                </div>
            ) : !a ? (
                <div role="status" className="flex flex-col items-start gap-3 rounded-2xl border-2 border-(--accent) bg-(--accent)/15 px-4 py-3.5">
                    <p className="leading-relaxed">You haven't added a shipping address to Hack Club Auth yet. Add one there, then check again.</p>
                    <RecheckButton onClick={address.reload} label="Check again" />
                </div>
            ) : (
                <>
                    <div className="flex items-start gap-3 rounded-2xl border-2 border-white/15 bg-(--bg)/45 px-4 py-3.5">
                        <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-(--text)/80" />
                        <address className="min-w-0 leading-relaxed not-italic break-words">
                            {a.name && <span className="block font-semibold">{a.name}</span>}
                            <span className="block">{a.line1}</span>
                            {a.line2 && <span className="block">{a.line2}</span>}
                            <span className="block">{[a.city, a.state, a.postalCode].filter(Boolean).join(", ")}</span>
                            <span className="block">{a.country}</span>
                            <span className="mt-1 block text-sm text-(--text)/75">Prices for {regionName(a.region)}</span>
                        </address>
                    </div>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-1 has-focus-visible:outline-2 has-focus-visible:outline-solid has-focus-visible:outline-offset-3 has-focus-visible:outline-(--text)">
                        <input
                            id={`${id}-confirm`}
                            type="checkbox"
                            checked={confirmed}
                            onChange={(e) => onConfirm(e.target.checked)}
                            aria-invalid={error ? true : undefined}
                            aria-describedby={error ? `${id}-confirm-error` : undefined}
                            className="size-5 shrink-0 cursor-pointer accent-(--accent)"
                        />
                        <span className="font-medium">Ship it to this address</span>
                    </label>
                    <FieldError id={`${id}-confirm-error`}>{error}</FieldError>
                </>
            )}
        </section>
    );
}

function RecheckButton({ onClick, label }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`-ml-3 inline-flex min-h-11 items-center gap-2 rounded-(--radius) px-3 font-medium text-(--text) underline decoration-(--accent) decoration-2 underline-offset-4 transition-all duration-300 ease hover:bg-white/10 ${FOCUS}`}
        >
            <RotateCw aria-hidden="true" className="size-4" />
            {label}
        </button>
    );
}

function Ordered({ id, order, volts, onDone }) {
    const doneRef = useRef(null);
    useEffect(() => { doneRef.current?.focus(); }, []);

    return (
        <div role="status" className="flex flex-col items-start gap-4 px-5 pb-6 sm:px-8 sm:pb-8">
            <CircleCheck aria-hidden="true" className="size-10 text-(--accent)" />
            <h2 id={`${id}-title`} className="text-2xl font-bold text-balance">
                {order.quantity > 1 ? `${order.quantity}× ` : ""}{order.itemName}{order.variantName ? ` (${order.variantName})` : ""} is ordered
            </h2>
            <p className="max-w-[50ch] leading-relaxed text-(--text)/90">
                It's in the shipping queue. We'll DM you on Slack when it ships, and you can follow it under Your orders.
                You have {volts.toLocaleString()} Volts left.
            </p>
            <button ref={doneRef} type="button" onClick={onDone} className={`${BTN_PRIMARY} mt-2`}>Done</button>
        </div>
    );
}
