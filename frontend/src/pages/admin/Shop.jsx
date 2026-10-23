import { useId, useMemo, useState } from "react";
import { Dices, FileUp, Pencil, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import AdminShell from "../../components/admin/AdminShell.jsx";
import { ConfirmBox, Panel, Tag } from "../../components/admin/AdminParts.jsx";
import { Empty, InlineError } from "../../components/PageParts.jsx";
import { BTN_GHOST, BTN_OUTLINE, BTN_PRIMARY, FOCUS, FieldError, FormError, INPUT } from "../../components/Form.jsx";
import { ItemImage, Volts } from "../../components/shop/ShopParts.jsx";
import { useAction } from "../../lib/admin.js";
import {
    bulkCreateShopItems,
    createShopItem,
    deleteShopItem,
    getAdminShopDaily,
    getAdminShopItems,
    setShopDaily,
    updateShopItem,
} from "../../lib/endpoints.js";
import { formatDay, LEVELS } from "../../lib/projects.js";
import { RANDOM_MODES, REGIONS } from "../../lib/shop.js";
import { CSV_HEADER, parseBulk } from "../../lib/shopImport.js";
import { useApi } from "../../lib/useApi.js";

const MAX_BULK = 200;

// /admin/shop — the catalogue: today's random item, then every item (active or
// not) with create / edit / delete in place, and a bulk add from CSV or JSON.
export default function AdminShop() {
    return (
        <AdminShell title="Shop items">
            <ShopAdmin />
        </AdminShell>
    );
}

function ShopAdmin() {
    const items = useApi(getAdminShopItems);
    const [open, setOpen] = useState(null); // null | "new" | "bulk"

    const refocus = (key) => requestAnimationFrame(() => document.querySelector(`[data-opens="${key}"]`)?.focus());

    return (
        <div className="flex flex-col gap-6">
            <DailyPanel items={items.data} />

            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-[60ch] leading-relaxed text-(--text)/85">
                    Items unlock by level. Prices are in Volts, with an optional override per region, and options add or take off Volts on top.
                </p>
                {!open && (
                    <div className="flex flex-wrap gap-2">
                        <button type="button" data-opens="bulk" onClick={() => setOpen("bulk")} className={BTN_OUTLINE}>
                            <FileUp aria-hidden="true" className="size-4.5" />
                            Bulk add
                        </button>
                        <button type="button" data-opens="new" onClick={() => setOpen("new")} className={BTN_PRIMARY}>
                            <Plus aria-hidden="true" className="size-4.5" strokeWidth={2.5} />
                            New item
                        </button>
                    </div>
                )}
            </div>

            {open === "new" && (
                <ItemEditor
                    heading="New item"
                    submitLabel="Add item"
                    onSubmit={createShopItem}
                    onDone={() => { setOpen(null); items.reload(); }}
                    onCancel={() => { setOpen(null); refocus("new"); }}
                />
            )}
            {open === "bulk" && (
                <BulkAdd
                    onDone={() => { setOpen(null); items.reload(); }}
                    onCancel={() => { setOpen(null); refocus("bulk"); }}
                />
            )}

            {items.loading && !items.data ? (
                <div aria-busy="true" aria-label="Loading shop items" className="t-card h-64 motion-safe:animate-pulse text-(--text)!" />
            ) : items.error ? (
                <InlineError what="shop items" onRetry={items.reload} />
            ) : items.data.length === 0 ? (
                open ? null : (
                    <Empty title="No items yet">
                        Add the first prize with New item, or paste a whole list with Bulk add. Builders see them on /shop as soon as they're active.
                    </Empty>
                )
            ) : (
                <section aria-labelledby="items-heading" className="flex flex-col gap-3">
                    <h2 id="items-heading" className="sr-only">Shop items</h2>
                    <ul className="t-card divide-y-2 divide-white/10 overflow-hidden text-(--text)!">
                        {items.data.map((item) => <ItemRow key={item.id} item={item} onChanged={items.reload} />)}
                    </ul>
                    <p className="text-sm text-(--text)/75 tabular-nums">
                        {items.data.length} {items.data.length === 1 ? "item" : "items"} · {items.data.filter((i) => i.isActive).length} active
                    </p>
                </section>
            )}
        </div>
    );
}

// Today's random item, with a reroll and a way to pick one by hand.
function DailyPanel({ items }) {
    const daily = useApi(getAdminShopDaily);
    const action = useAction();
    const [pick, setPick] = useState("");
    // { itemId } waiting on the confirm box (null itemId = reroll), or null.
    const [confirming, setConfirming] = useState(null);
    const active = (items ?? []).filter((i) => i.isActive);
    const pickedName = active.find((i) => i.id === confirming?.itemId)?.name;

    async function set(itemId) {
        if (await action.run(() => setShopDaily(itemId))) {
            setPick("");
            setConfirming(null);
            daily.reload();
        }
    }

    const current = daily.data?.current;
    return (
        <Panel id="daily-heading" title="Random item of the day">
            {daily.loading && !daily.data ? (
                <div aria-busy="true" className="h-16 rounded-2xl bg-white/10 motion-safe:animate-pulse" />
            ) : daily.error ? (
                <InlineError what="today's random item" onRetry={daily.reload} />
            ) : (
                <div className="flex flex-col gap-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex min-w-0 flex-col gap-0.5">
                            <p className="text-xl font-semibold break-words">{current?.itemName ?? "Nothing eligible to roll"}</p>
                            <p className="text-sm text-(--text)/80">
                                {current?.setByUserId ? "Picked by an admin" : "Rolled at random"} · changes at 12 AM US Eastern
                                {daily.data.endsAt && ` (${new Date(daily.data.endsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} your time)`}
                            </p>
                        </div>
                        <button type="button" disabled={action.busy || Boolean(confirming)} onClick={() => setConfirming({ itemId: null })} className={BTN_OUTLINE}>
                            <Dices aria-hidden="true" className="size-4.5" />
                            Reroll
                        </button>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <label className="flex flex-1 flex-col gap-2">
                            <span className="font-semibold">Or pick today's item</span>
                            <select value={pick} onChange={(e) => setPick(e.target.value)} className={`${INPUT} cursor-pointer [&>option]:bg-(--card)`}>
                                <option value="">Choose an active item…</option>
                                {active.map((i) => <option key={i.id} value={i.id}>{`Level ${i.tier} · ${i.name}`}</option>)}
                            </select>
                        </label>
                        <button type="button" disabled={!pick || action.busy || Boolean(confirming)} onClick={() => setConfirming({ itemId: pick })} className={BTN_OUTLINE}>
                            Make it today's item
                        </button>
                    </div>
                    {confirming && (
                        <ConfirmBox
                            id="daily-confirm"
                            title={confirming.itemId ? `Make ${pickedName ?? "this item"} today's random item?` : "Reroll today's random item?"}
                            confirmLabel={confirming.itemId ? "Make it today's" : "Reroll it"}
                            busyLabel={confirming.itemId ? "Saving…" : "Rolling…"}
                            icon={Dices}
                            busy={action.busy}
                            onConfirm={() => set(confirming.itemId)}
                            onCancel={() => setConfirming(null)}
                        >
                            Every builder's shop changes straight away, and anyone who had today's item open can no longer buy it.
                        </ConfirmBox>
                    )}
                    <FormError>{action.error}</FormError>
                    {daily.data.picks.length > 1 && (
                        <details className="group">
                            <summary className={`-ml-3 inline-flex min-h-11 cursor-pointer items-center rounded-(--radius) px-3 font-medium underline decoration-(--accent) decoration-2 underline-offset-4 transition-all duration-300 ease hover:bg-white/10 ${FOCUS}`}>
                                Recent random items
                            </summary>
                            <ul className="mt-2 flex flex-col divide-y-2 divide-white/10 rounded-2xl border-2 border-white/10 bg-(--bg)/30">
                                {daily.data.picks.map((p) => (
                                    <li key={p.date} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                                        <span className="break-words">{p.itemName ?? "Deleted item"}</span>
                                        <span className="shrink-0 text-(--text)/75 tabular-nums">{formatDay(`${p.date}T12:00:00`)}</span>
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}
                </div>
            )}
        </Panel>
    );
}

function ItemRow({ item, onChanged }) {
    const [mode, setMode] = useState(null); // null | "edit" | "delete"
    const remove = useAction();

    if (mode === "edit") {
        return (
            <li>
                <ItemEditor
                    inline
                    heading={`Edit ${item.name}`}
                    initial={item}
                    submitLabel="Save changes"
                    onSubmit={(body) => updateShopItem(item.id, body)}
                    onDone={() => { setMode(null); onChanged(); }}
                    onCancel={() => setMode(null)}
                />
            </li>
        );
    }

    const regions = item.regions.length === REGIONS.length ? "Ships everywhere" : `Ships to ${item.regions.join(", ")}`;
    const stock = item.variants.length > 0
        ? `${item.variants.length} options`
        : item.stock == null ? "Unlimited" : `${item.stock} left`;

    return (
        <li className="flex flex-col gap-4 px-5 py-4 sm:px-6">
            <div className="flex items-start gap-4">
                <ItemImage src={item.imageUrl} className={`size-12 rounded-xl border-2 border-white/15 ${item.isActive ? "" : "opacity-60"}`} />
                <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:gap-5">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <p className="font-semibold break-words">{item.name}</p>
                        <p className="flex flex-wrap items-center gap-x-2 text-sm text-(--text)/80 tabular-nums">
                            <span>Level {item.tier}</span>·<Volts amount={item.price} />·<span>{stock}</span>·<span>{regions}</span>·<span>{item.sold} sold</span>
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {!item.isActive && <Tag>Hidden</Tag>}
                        {item.randomMode === "random_only" && <Tag accent>Random only</Tag>}
                        {item.randomMode === "never" && <Tag>Never random</Tag>}
                        {item.variants.length === 0 && item.stock === 0 && <Tag accent>Out of stock</Tag>}
                        <button type="button" onClick={() => setMode("edit")} className={`${BTN_OUTLINE} min-h-10 px-4 text-sm`}>
                            <Pencil aria-hidden="true" className="size-4" />
                            Edit<span className="sr-only"> {item.name}</span>
                        </button>
                        <button
                            type="button"
                            aria-expanded={mode === "delete"}
                            onClick={() => setMode(mode === "delete" ? null : "delete")}
                            className={`${BTN_GHOST} min-h-10 px-4 text-sm`}
                        >
                            <Trash2 aria-hidden="true" className="size-4" />
                            Delete<span className="sr-only"> {item.name}</span>
                        </button>
                    </div>
                </div>
            </div>
            {mode === "delete" && (
                <ConfirmBox
                    id={`delete-${item.id}`}
                    title={item.sold > 0 ? `Hide ${item.name}?` : `Delete ${item.name}?`}
                    confirmLabel={item.sold > 0 ? "Hide it" : "Delete it"}
                    busyLabel={item.sold > 0 ? "Hiding…" : "Deleting…"}
                    icon={Trash2}
                    busy={remove.busy}
                    onConfirm={async () => { if (await remove.run(() => deleteShopItem(item.id))) onChanged(); }}
                    onCancel={() => setMode(null)}
                >
                    {item.sold > 0
                        ? "People have ordered it, so it's hidden from the shop instead of deleted. Its orders stay in the queue."
                        : "Nobody has ordered it, so it's removed for good."}
                </ConfirmBox>
            )}
            <FormError>{remove.error}</FormError>
        </li>
    );
}

const numberOrNull = (text) => (text.trim() === "" ? null : Number(text));
const isWhole = (text) => text.trim() === "" || /^-?\d+$/.test(text.trim());

// Create or replace an item. Sends the whole item (the PUT replaces every field).
// `inline` draws it flat, for editing in place inside the item list's card.
function ItemEditor({ heading, initial, submitLabel, onSubmit, onDone, onCancel, inline = false }) {
    const id = useId();
    const [name, setName] = useState(initial?.name ?? "");
    const [description, setDescription] = useState(initial?.description ?? "");
    const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
    const [tier, setTier] = useState(initial?.tier ?? 1);
    const [price, setPrice] = useState(initial ? String(initial.price) : "");
    const [stock, setStock] = useState(initial?.stock != null ? String(initial.stock) : "");
    const [maxPerUser, setMaxPerUser] = useState(initial?.maxPerUser != null ? String(initial.maxPerUser) : "");
    const [randomMode, setRandomMode] = useState(initial?.randomMode ?? "eligible");
    const [isActive, setIsActive] = useState(initial?.isActive ?? true);
    const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
    const [fulfillerNotes, setFulfillerNotes] = useState(initial?.fulfillerNotes ?? "");
    const [regions, setRegions] = useState(() =>
        Object.fromEntries(REGIONS.map(([code]) => [code, {
            on: initial ? initial.regions.includes(code) : true,
            price: initial?.regionalPrices?.[code] != null ? String(initial.regionalPrices[code]) : "",
        }])));
    const [variants, setVariants] = useState(() =>
        (initial?.variants ?? []).map((v) => ({
            key: v.id, id: v.id, name: v.name, priceDelta: String(v.priceDelta), stock: v.stock != null ? String(v.stock) : "", isActive: v.isActive,
        })));
    const [errors, setErrors] = useState({});
    const save = useAction();

    const setRegion = (code, change) => setRegions((r) => ({ ...r, [code]: { ...r[code], ...change } }));
    const setVariant = (key, change) => setVariants((vs) => vs.map((v) => (v.key === key ? { ...v, ...change } : v)));

    function validate() {
        const e = {};
        if (!name.trim()) e.name = "Give it a name.";
        if (!/^\d+$/.test(price.trim())) e.price = "Price is a whole number of Volts.";
        if (!isWhole(stock) || Number(stock) < 0) e.stock = "Leave it empty for unlimited, or a whole number.";
        if (!isWhole(maxPerUser) || (maxPerUser.trim() && Number(maxPerUser) < 1)) e.maxPerUser = "Leave it empty for no limit, or 1 or more.";
        if (!Object.values(regions).some((r) => r.on)) e.regions = "Pick at least one region it ships to.";
        else if (Object.values(regions).some((r) => r.on && !isWhole(r.price))) e.regions = "Region prices are whole numbers of Volts (or empty to use the base price).";
        if (variants.some((v) => !v.name.trim())) e.variants = "Every option needs a name.";
        else if (variants.some((v) => !isWhole(v.priceDelta) || !isWhole(v.stock))) e.variants = "Option price changes and stock are whole numbers.";
        return e;
    }

    async function submit(event) {
        event.preventDefault();
        const found = validate();
        setErrors(found);
        if (Object.keys(found).length) {
            document.querySelector(`[data-editor="${id}"] [aria-invalid="true"]`)?.focus();
            return;
        }

        const body = {
            name: name.trim(),
            description: description.trim(),
            imageUrl: imageUrl.trim() || null,
            tier,
            price: Number(price),
            stock: numberOrNull(stock),
            maxPerUser: numberOrNull(maxPerUser),
            randomMode,
            isActive,
            sortOrder: numberOrNull(sortOrder) ?? 0,
            fulfillerNotes: fulfillerNotes.trim() || null,
            regions: REGIONS.map(([code]) => code).filter((code) => regions[code].on),
            regionalPrices: Object.fromEntries(
                Object.entries(regions).filter(([, r]) => r.on && r.price.trim() !== "").map(([code, r]) => [code, Number(r.price)])),
            variants: variants.map((v, i) => ({
                id: v.id ?? null,
                name: v.name.trim(),
                priceDelta: numberOrNull(v.priceDelta) ?? 0,
                stock: numberOrNull(v.stock),
                isActive: v.isActive,
                sortOrder: i,
            })),
        };
        if (await save.run(() => onSubmit(body))) onDone();
    }

    const label = "font-semibold";
    return (
        <form
            onSubmit={submit}
            noValidate
            data-editor={id}
            aria-labelledby={`${id}-heading`}
            className={inline
                ? "flex flex-col gap-6 bg-(--accent)/5 px-5 py-6 text-(--text) sm:px-6"
                : "t-card flex flex-col gap-6 border-(--accent) px-5 py-6 text-(--text)! sm:px-8"}
        >
            <h2 id={`${id}-heading`} className="flex items-center gap-2.5 text-xl font-bold break-words">
                <ShoppingBag aria-hidden="true" className="size-5 shrink-0 text-(--accent)" />
                {heading}
            </h2>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_14rem]">
                <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                        <label htmlFor={`${id}-name`} className={label}>Name</label>
                        <input id={`${id}-name`} autoFocus maxLength={120} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={errors.name ? true : undefined} className={INPUT} />
                        <FieldError>{errors.name}</FieldError>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label htmlFor={`${id}-desc`} className={label}>Description <span className="font-normal text-(--text)/75">(optional)</span></label>
                        <textarea id={`${id}-desc`} rows={3} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} className={`${INPUT} resize-y`} />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label htmlFor={`${id}-img`} className={label}>Image link <span className="font-normal text-(--text)/75">(optional)</span></label>
                        <input id={`${id}-img`} type="url" inputMode="url" placeholder="https://…" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className={INPUT} />
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <span className={label} aria-hidden="true">Preview</span>
                    <ItemImage src={imageUrl.trim() || null} className="aspect-[4/3] w-full rounded-2xl border-2 border-white/15 p-2" />
                </div>
            </div>

            <fieldset className="flex flex-col gap-2.5">
                <legend className={`${label} mb-2.5`}>Level that unlocks it</legend>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {LEVELS.map(({ level, name: levelName }) => (
                        <label
                            key={level}
                            className="flex min-h-12 cursor-pointer items-center gap-2 rounded-2xl border-2 border-white/15 px-4 py-2 transition-all duration-300 ease hover:border-white/30 hover:bg-white/10 has-checked:border-(--accent) has-checked:bg-(--accent)/15 has-focus-visible:outline-2 has-focus-visible:outline-solid has-focus-visible:outline-offset-3 has-focus-visible:outline-(--text)"
                        >
                            <input type="radio" name={`${id}-tier`} checked={tier === level} onChange={() => setTier(level)} className="sr-only" />
                            <span className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-2">
                                <span className="font-semibold">Level {level}</span>
                                <span className="truncate text-sm text-(--text)/75">{levelName}</span>
                            </span>
                        </label>
                    ))}
                </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <NumberField id={`${id}-price`} label="Price" suffix="Volts" value={price} onChange={setPrice} error={errors.price} />
                <NumberField id={`${id}-stock`} label="Stock" hint="Empty = unlimited. Ignored with options." value={stock} onChange={setStock} error={errors.stock} />
                <NumberField id={`${id}-max`} label="Max per person" hint="Empty = no limit." value={maxPerUser} onChange={setMaxPerUser} error={errors.maxPerUser} />
            </div>

            <fieldset className="flex flex-col gap-2.5">
                <legend className={`${label} mb-1`}>Regions it ships to</legend>
                <p className="text-sm leading-relaxed text-(--text)/80">
                    Leave a price empty to charge the base price there. Builders outside the ticked regions see it but can't order it.
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {REGIONS.map(([code, regionName]) => {
                        const r = regions[code];
                        return (
                            <div key={code} className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-2 transition-colors duration-300 ease ${r.on ? "border-white/25" : "border-white/10"}`}>
                                <label className="flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                                    <input type="checkbox" checked={r.on} onChange={(e) => setRegion(code, { on: e.target.checked })} className="size-5 shrink-0 cursor-pointer accent-(--accent)" />
                                    <span className={`truncate font-medium ${r.on ? "" : "text-(--text)/70"}`}>{regionName}</span>
                                </label>
                                <div className="w-20 shrink-0 sm:w-24">
                                    <input
                                        aria-label={`Price in ${regionName}`}
                                        inputMode="numeric"
                                        disabled={!r.on}
                                        placeholder="Base"
                                        value={r.price}
                                        onChange={(e) => setRegion(code, { price: e.target.value })}
                                        className={`${INPUT} py-1.5 text-right tabular-nums disabled:opacity-40`}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
                <FieldError>{errors.regions}</FieldError>
            </fieldset>

            <fieldset className="flex flex-col gap-2.5">
                <legend className={`${label} mb-1`}>Options <span className="font-normal text-(--text)/75">(optional)</span></legend>
                <p className="text-sm leading-relaxed text-(--text)/80">
                    Like storage sizes. Buyers must pick one. Each adds (or takes off) Volts from the price and keeps its own stock.
                </p>
                {variants.length > 0 && (
                    <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1fr)_7rem_7rem_auto_auto] gap-2 px-4 text-sm text-(--text)/75 sm:grid">
                        <span>Option</span>
                        <span className="text-right">Price change</span>
                        <span className="text-right">Stock</span>
                        <span className="w-[5.5rem]" />
                        <span className="w-10" />
                    </div>
                )}
                {variants.length > 0 && (
                    <ul className="flex flex-col gap-2">
                        {variants.map((v, i) => (
                            <li key={v.key} className="grid grid-cols-2 items-center gap-2 rounded-2xl border-2 border-white/15 p-2 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_auto_auto]">
                                <input aria-label={`Option ${i + 1} name`} placeholder="e.g. 64 GB" value={v.name} onChange={(e) => setVariant(v.key, { name: e.target.value })} className={`${INPUT} col-span-2 py-1.5 sm:col-span-1`} />
                                <input aria-label={`Option ${i + 1} price change in Volts`} inputMode="numeric" placeholder="+0" value={v.priceDelta} onChange={(e) => setVariant(v.key, { priceDelta: e.target.value })} className={`${INPUT} py-1.5 text-right tabular-nums`} />
                                <input aria-label={`Option ${i + 1} stock, empty for unlimited`} inputMode="numeric" placeholder="Stock ∞" value={v.stock} onChange={(e) => setVariant(v.key, { stock: e.target.value })} className={`${INPUT} py-1.5 text-right tabular-nums`} />
                                <label className="flex min-h-10 cursor-pointer items-center gap-2 px-2 text-sm">
                                    <input type="checkbox" checked={v.isActive} onChange={(e) => setVariant(v.key, { isActive: e.target.checked })} className="size-4.5 cursor-pointer accent-(--accent)" />
                                    On sale
                                </label>
                                <button
                                    type="button"
                                    aria-label={`Remove option ${v.name || i + 1}`}
                                    onClick={() => setVariants((vs) => vs.filter((x) => x.key !== v.key))}
                                    className={`inline-flex size-10 items-center justify-center justify-self-end rounded-full text-(--text)/80 transition-colors duration-300 ease hover:bg-white/10 hover:text-(--text) ${FOCUS}`}
                                >
                                    <X aria-hidden="true" className="size-4.5" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                <button
                    type="button"
                    onClick={() => setVariants((vs) => [...vs, { key: crypto.randomUUID(), id: null, name: "", priceDelta: "", stock: "", isActive: true }])}
                    className={`${BTN_GHOST} self-start`}
                >
                    <Plus aria-hidden="true" className="size-4.5" />
                    Add an option
                </button>
                <FieldError>{errors.variants}</FieldError>
            </fieldset>

            <fieldset className="flex flex-col gap-2.5">
                <legend className={`${label} mb-2.5`}>Random item of the day</legend>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    {RANDOM_MODES.map(([value, text]) => (
                        <label
                            key={value}
                            className="flex min-h-12 cursor-pointer items-center gap-2.5 rounded-2xl border-2 border-white/15 px-4 py-2 transition-all duration-300 ease hover:border-white/30 hover:bg-white/10 has-checked:border-(--accent) has-checked:bg-(--accent)/15 has-focus-visible:outline-2 has-focus-visible:outline-solid has-focus-visible:outline-offset-3 has-focus-visible:outline-(--text)"
                        >
                            <input type="radio" name={`${id}-random`} checked={randomMode === value} onChange={() => setRandomMode(value)} className="sr-only" />
                            <span className="text-sm font-medium">{text}</span>
                        </label>
                    ))}
                </div>
            </fieldset>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_10rem]">
                <div className="flex flex-col gap-2">
                    <label htmlFor={`${id}-notes`} className={label}>Notes for whoever ships it <span className="font-normal text-(--text)/75">(staff only)</span></label>
                    <textarea id={`${id}-notes`} rows={2} maxLength={2000} placeholder="Supplier link, packing notes…" value={fulfillerNotes} onChange={(e) => setFulfillerNotes(e.target.value)} className={`${INPUT} resize-y`} />
                </div>
                <NumberField id={`${id}-sort`} label="Sort order" hint="Lower comes first." value={sortOrder} onChange={setSortOrder} />
            </div>

            <label className="flex min-h-11 cursor-pointer items-center gap-3 self-start rounded-xl px-1 has-focus-visible:outline-2 has-focus-visible:outline-solid has-focus-visible:outline-offset-3 has-focus-visible:outline-(--text)">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-5 cursor-pointer accent-(--accent)" />
                <span className="font-medium">Show it in the shop</span>
            </label>

            <FormError>{save.error}</FormError>
            <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={save.busy} className={BTN_PRIMARY}>{save.busy ? "Saving…" : submitLabel}</button>
                <button type="button" disabled={save.busy} onClick={onCancel} className={BTN_GHOST}>Cancel</button>
            </div>
        </form>
    );
}

function NumberField({ id, label, hint, suffix, value, onChange, error }) {
    return (
        <div className="flex flex-col gap-2">
            <label htmlFor={id} className="font-semibold">{label}</label>
            <div className="relative">
                <input
                    id={id}
                    inputMode="numeric"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={hint ? `${id}-hint` : undefined}
                    className={`${INPUT} tabular-nums ${suffix ? "pr-16" : ""}`}
                />
                {suffix && <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-(--text)/75">{suffix}</span>}
            </div>
            <FieldError>{error}</FieldError>
            {hint && <p id={`${id}-hint`} className="text-sm text-(--text)/75">{hint}</p>}
        </div>
    );
}

// Paste CSV or JSON, check the parsed rows, then add them all at once. The
// server is all-or-nothing; its per-row problems show next to each row.
function BulkAdd({ onDone, onCancel }) {
    const id = useId();
    const [text, setText] = useState("");
    const [serverRows, setServerRows] = useState({});
    const save = useAction();
    const parsed = useMemo(() => parseBulk(text), [text]);
    const rows = parsed.rows ?? [];
    const clientErrors = rows.filter((r) => r.error).length;
    const ready = rows.length > 0 && rows.length <= MAX_BULK && clientErrors === 0 && !parsed.error;

    async function submit(e) {
        e.preventDefault();
        if (!ready) return;
        setServerRows({});
        let failure = null;
        const ok = await save.run(async () => {
            try {
                await bulkCreateShopItems(rows.map((r) => r.item));
            } catch (err) {
                failure = err;
                throw err;
            }
        });
        if (ok) onDone();
        else if (failure?.rows) setServerRows(Object.fromEntries(failure.rows.map((r) => [r.index, r.error])));
    }

    return (
        <form onSubmit={submit} aria-labelledby={`${id}-heading`} className="t-card flex flex-col gap-5 border-(--accent) px-5 py-6 text-(--text)! sm:px-8">
            <h2 id={`${id}-heading`} className="flex items-center gap-2.5 text-xl font-bold">
                <FileUp aria-hidden="true" className="size-5 text-(--accent)" />
                Bulk add items
            </h2>
            <div className="flex flex-col gap-2 text-sm leading-relaxed text-(--text)/85">
                <p>
                    Paste CSV with a header row, or a JSON array shaped like the API's item body. Only <strong>name</strong>, <strong>tier</strong> and{" "}
                    <strong>price</strong> are required. Nothing is added unless every row is valid.
                </p>
                <ul className="list-disc pl-5">
                    <li><code className="font-mono text-[0.8125rem]">regions</code>: <code className="font-mono text-[0.8125rem]">US;EU;UK</code>, or empty for everywhere ({REGIONS.map(([c]) => c).join(", ")})</li>
                    <li><code className="font-mono text-[0.8125rem]">regionPrices</code>: <code className="font-mono text-[0.8125rem]">US=120;IN=80</code></li>
                    <li><code className="font-mono text-[0.8125rem]">variants</code>: name:price change:stock, split by <code className="font-mono text-[0.8125rem]">|</code>, e.g. <code className="font-mono text-[0.8125rem]">32 GB:0:10|64 GB:40:5</code></li>
                    <li><code className="font-mono text-[0.8125rem]">randomMode</code>: eligible, random_only or never</li>
                </ul>
            </div>
            <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor={`${id}-paste`} className="font-semibold">CSV or JSON</label>
                    <button
                        type="button"
                        onClick={() => setText((t) => (t.trim() ? t : `${CSV_HEADER}\n`))}
                        className={`-mr-3 inline-flex min-h-11 items-center rounded-(--radius) px-3 text-sm font-medium underline decoration-(--accent) decoration-2 underline-offset-4 transition-all duration-300 ease hover:bg-white/10 ${FOCUS}`}
                    >
                        Start from the CSV header
                    </button>
                </div>
                <textarea
                    id={`${id}-paste`}
                    autoFocus
                    rows={8}
                    spellCheck={false}
                    value={text}
                    onChange={(e) => { setText(e.target.value); setServerRows({}); }}
                    placeholder={CSV_HEADER}
                    className={`${INPUT} resize-y font-mono text-sm`}
                />
            </div>

            {parsed.error ? (
                <FormError>{parsed.error}</FormError>
            ) : rows.length > 0 && (
                <section aria-labelledby={`${id}-preview`} className="flex flex-col gap-2">
                    <h3 id={`${id}-preview`} className="font-semibold">
                        {rows.length} {rows.length === 1 ? "item" : "items"} to add
                        {clientErrors > 0 && <span className="font-normal text-(--text)/85"> · {clientErrors} to fix first</span>}
                    </h3>
                    {rows.length > MAX_BULK && <FieldError>At most {MAX_BULK} items per bulk add.</FieldError>}
                    <ol className="t-scroll flex max-h-96 flex-col divide-y-2 divide-white/10 overflow-y-auto rounded-2xl border-2 border-white/10 bg-(--bg)/30">
                        {rows.map((row, i) => {
                            const problem = row.error ?? serverRows[i];
                            const item = row.item ?? {};
                            return (
                                <li key={i} className={`flex flex-col gap-1 px-4 py-2.5 ${problem ? "bg-(--accent)/10" : ""}`}>
                                    <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                                        <span className="text-(--text)/70 tabular-nums">{i + 1}.</span>
                                        <span className="font-semibold break-words">{item.name || "(no name)"}</span>
                                        {item.tier != null && <span className="text-(--text)/80">Level {item.tier}</span>}
                                        {item.price != null && <span className="text-(--text)/80 tabular-nums">{item.price} Volts</span>}
                                        {item.variants?.length > 0 && <span className="text-(--text)/80">{item.variants.length} options</span>}
                                        {item.regions && item.regions.length < REGIONS.length && <span className="text-(--text)/80">{item.regions.join(", ")}</span>}
                                    </p>
                                    <FieldError>{problem}</FieldError>
                                </li>
                            );
                        })}
                    </ol>
                </section>
            )}

            <FormError>{save.error}</FormError>
            <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={!ready || save.busy} className={BTN_PRIMARY}>
                    {save.busy ? "Adding…" : rows.length > 0 ? `Add ${rows.length} ${rows.length === 1 ? "item" : "items"}` : "Add items"}
                </button>
                <button type="button" disabled={save.busy} onClick={onCancel} className={BTN_GHOST}>Cancel</button>
            </div>
        </form>
    );
}
