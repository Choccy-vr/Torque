import { useCallback, useId, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, PackageCheck, Undo2 } from "lucide-react";
import AdminShell from "../../components/admin/AdminShell.jsx";
import { BackLink, ConfirmBox, CopyId, EntityTitle, Facts, NotFoundNote, Panel, Tag } from "../../components/admin/AdminParts.jsx";
import { InlineError, Notice } from "../../components/PageParts.jsx";
import { BTN_GHOST, BTN_PRIMARY, FOCUS, FieldError, FormError, INPUT } from "../../components/Form.jsx";
import { ItemImage } from "../../components/shop/ShopParts.jsx";
import { useAction } from "../../lib/admin.js";
import { fulfillShopOrder, getAdminShopOrder, getAdminShopOrders, refundShopOrder } from "../../lib/endpoints.js";
import { formatWhen } from "../../lib/projects.js";
import { ORDER_STATUS, regionName } from "../../lib/shop.js";
import { useApi } from "../../lib/useApi.js";

const LINK = `font-medium text-(--text) underline decoration-(--accent)/55 decoration-2 underline-offset-4 transition-colors duration-300 ease hover:decoration-(--accent) ${FOCUS}`;

// /admin/shop/orders/:id — one order: what to send, where to send it (the
// address the buyer confirmed at checkout), then mark it shipped or refund it.
export default function AdminShopOrder() {
    const { id } = useParams();
    return (
        <AdminShell title="Order">
            <OrderDetail key={id} id={id} />
        </AdminShell>
    );
}

function OrderDetail({ id }) {
    const fetchOrder = useCallback(() => getAdminShopOrder(id), [id]);
    const api = useApi(fetchOrder);
    const o = api.data;
    // After shipping this one: the next order waiting (null = none left), so a
    // run through the queue doesn't need a trip back to the list each time.
    const [next, setNext] = useState(undefined);

    if (api.error) {
        return (
            <div className="flex flex-col gap-4">
                <BackLink to="/admin/shop/orders">Orders</BackLink>
                {api.error.status === 404
                    ? <NotFoundNote>No order with this id.</NotFoundNote>
                    : <InlineError what="this order" onRetry={api.reload} />}
            </div>
        );
    }
    if (!o) return <div aria-busy="true" aria-label="Loading order" className="t-card h-96 motion-safe:animate-pulse text-(--text)!" />;

    const a = o.address;
    return (
        <div className="flex flex-col gap-6">
            <BackLink to="/admin/shop/orders">Orders</BackLink>

            <section aria-labelledby="order-title" className="t-card flex flex-col gap-6 px-5 py-6 text-(--text)! sm:px-8 sm:py-8">
                <div className="flex items-start gap-5">
                    <ItemImage src={o.imageUrl} className="size-20 rounded-[1.25rem] border-2 border-white/15" />
                    <div className="flex min-w-0 flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <Tag accent={o.status === "pending"}>{ORDER_STATUS[o.status]}</Tag>
                            {o.viaDaily && <Tag>Random item of the day</Tag>}
                        </div>
                        <EntityTitle id="order-title">
                            {o.quantity > 1 && `${o.quantity}× `}{o.itemName}{o.variantName && ` · ${o.variantName}`}
                        </EntityTitle>
                        <p className="text-(--text)/85">
                            Ordered by <Link to={`/admin/users/${o.userId}`} className={LINK}>{o.username || "unknown"}</Link> on {formatWhen(o.createdAt)}
                        </p>
                    </div>
                </div>

                <Facts
                    items={[
                        ["Paid", `${o.totalPrice.toLocaleString()} Volts${o.quantity > 1 ? ` (${o.quantity} × ${o.unitPrice.toLocaleString()})` : ""}`],
                        ["Region", regionName(o.region)],
                        ["Email", o.userEmail || null],
                        ["Slack ID", o.userSlackId ? <CopyId value={o.userSlackId} /> : null],
                        ["Shipped", o.fulfilledAt ? formatWhen(o.fulfilledAt) : null],
                        o.trackingReference && ["Tracking", <span className="break-all select-all">{o.trackingReference}</span>],
                        o.refundedAt && ["Refunded", formatWhen(o.refundedAt)],
                        ["Order id", <CopyId value={o.id} />],
                    ]}
                />

                {(o.userNote || o.fulfillerNotes || o.adminNote) && (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {o.userNote && <Quote title="Buyer's note">{o.userNote}</Quote>}
                        {o.fulfillerNotes && <Quote title="Item notes (staff only)">{o.fulfillerNotes}</Quote>}
                        {o.adminNote && <Quote title="Admin note (staff only)">{o.adminNote}</Quote>}
                    </div>
                )}
            </section>

            <Panel id="ship-to" title="Ship to">
                <address className="flex flex-col rounded-2xl border-2 border-white/15 bg-(--bg)/45 px-4 py-3.5 leading-relaxed not-italic break-words select-all">
                    <span className="font-semibold">{a.name}</span>
                    <span>{a.line1}</span>
                    {a.line2 && <span>{a.line2}</span>}
                    <span>{[a.city, a.state, a.postalCode].filter(Boolean).join(", ")}</span>
                    <span>{a.country}</span>
                </address>
                <p className="text-sm leading-relaxed text-(--text)/80">
                    The address the buyer confirmed at checkout, copied from Hack Club Auth then. Ship here even if they've changed it since.
                </p>
            </Panel>

            {next !== undefined && (
                <div role="status">
                    <Notice
                        icon={PackageCheck}
                        action={next && (
                            <Link
                                to={`/admin/shop/orders/${next.id}`}
                                className={`inline-flex min-h-11 items-center gap-1.5 rounded-(--radius) px-3 font-medium whitespace-nowrap text-(--text) underline decoration-(--accent) decoration-2 underline-offset-4 transition-all duration-300 ease hover:bg-white/10 ${FOCUS}`}
                            >
                                Next order
                                <ArrowRight aria-hidden="true" className="size-4" />
                            </Link>
                        )}
                    >
                        {next
                            ? `Marked as shipped. Next waiting: ${next.quantity > 1 ? `${next.quantity}× ` : ""}${next.itemName} for ${next.username || "unknown"}.`
                            : "Marked as shipped. Nothing else is waiting to ship."}
                    </Notice>
                </div>
            )}

            {o.status !== "refunded" && (
                <Actions
                    order={o}
                    onChanged={api.reload}
                    onShipped={async () => {
                        api.reload();
                        const pending = await getAdminShopOrders({ status: "pending" }).catch(() => []);
                        setNext(pending.find((p) => p.id !== o.id) ?? null);
                    }}
                />
            )}
        </div>
    );
}

// Mark shipped (pending only) and refund (pending or shipped).
function Actions({ order, onChanged, onShipped }) {
    const id = useId();
    const [tracking, setTracking] = useState("");
    const [note, setNote] = useState("");
    const [refunding, setRefunding] = useState(false);
    const [reason, setReason] = useState("");
    const [reasonError, setReasonError] = useState(null);
    const fulfill = useAction();
    const refund = useAction();

    async function ship(e) {
        e.preventDefault();
        if (await fulfill.run(() => fulfillShopOrder(order.id, { trackingReference: tracking.trim() || null, note: note.trim() || null }))) onShipped();
    }

    async function confirmRefund() {
        if (!reason.trim()) {
            setReasonError("Say why. The buyer gets this in their Slack DM.");
            return;
        }
        if (await refund.run(() => refundShopOrder(order.id, reason.trim()))) onChanged();
    }

    return (
        <Panel id="order-actions" title={order.status === "pending" ? "Ship it" : "Refund"}>
            {order.status === "pending" && (
                <form onSubmit={ship} className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <label htmlFor={`${id}-tracking`} className="font-semibold">
                                Tracking number or link <span className="font-normal text-(--text)/75">(optional)</span>
                            </label>
                            <input id={`${id}-tracking`} maxLength={500} value={tracking} onChange={(e) => setTracking(e.target.value)} className={INPUT} />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label htmlFor={`${id}-note`} className="font-semibold">
                                Note <span className="font-normal text-(--text)/75">(staff only, optional)</span>
                            </label>
                            <input id={`${id}-note`} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className={INPUT} />
                        </div>
                    </div>
                    <p className="text-sm leading-relaxed text-(--text)/80">The buyer gets a Slack DM saying it shipped, with the tracking if you add it.</p>
                    <FormError>{fulfill.error}</FormError>
                    <div>
                        <button type="submit" disabled={fulfill.busy} className={BTN_PRIMARY}>
                            <PackageCheck aria-hidden="true" className="size-4.5" />
                            {fulfill.busy ? "Saving…" : "Mark as shipped"}
                        </button>
                    </div>
                </form>
            )}

            <div className={order.status === "pending" ? "border-t-2 border-white/10 pt-5" : ""}>
                {refunding ? (
                    <ConfirmBox
                        id={`${id}-refund`}
                        title={`Refund ${order.totalPrice.toLocaleString()} Volts?`}
                        confirmLabel="Refund it"
                        busyLabel="Refunding…"
                        icon={Undo2}
                        busy={refund.busy}
                        onConfirm={confirmRefund}
                        onCancel={() => { setRefunding(false); setReasonError(null); }}
                    >
                        <div className="flex flex-col gap-3">
                            <p>
                                The Volts go back to {order.username || "the buyer"}
                                {order.status === "pending" ? " and the stock goes back on the shelf." : ". It already shipped, so stock isn't put back."}
                            </p>
                            <div className="flex flex-col gap-2">
                                <label htmlFor={`${id}-reason`} className="font-semibold">Reason (sent to the buyer)</label>
                                <textarea
                                    id={`${id}-reason`}
                                    rows={2}
                                    maxLength={2000}
                                    value={reason}
                                    onChange={(e) => { setReason(e.target.value); setReasonError(null); }}
                                    aria-invalid={reasonError ? true : undefined}
                                    className={`${INPUT} resize-y`}
                                />
                                <FieldError>{reasonError}</FieldError>
                            </div>
                        </div>
                    </ConfirmBox>
                ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="max-w-[55ch] text-sm leading-relaxed text-(--text)/80">
                            Can't send it? Refund the Volts and tell the buyer why.
                        </p>
                        <button type="button" onClick={() => setRefunding(true)} className={BTN_GHOST}>
                            <Undo2 aria-hidden="true" className="size-4.5" />
                            Refund order
                        </button>
                    </div>
                )}
                <div className="mt-3"><FormError>{refund.error}</FormError></div>
            </div>
        </Panel>
    );
}

function Quote({ title, children }) {
    return (
        <div className="flex flex-col gap-1.5 rounded-2xl border-2 border-white/15 bg-(--bg)/45 px-4 py-3">
            <p className="text-sm font-bold">{title}</p>
            <p className="leading-relaxed break-words whitespace-pre-line text-(--text)/90">{children}</p>
        </div>
    );
}
