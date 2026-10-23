import { useCallback } from "react";
import { Shuffle, Zap } from "lucide-react";
import AdminShell from "../../components/admin/AdminShell.jsx";
import { FilterSelect, ResultList, ResultRow, Tag, Toolbar } from "../../components/admin/AdminParts.jsx";
import { ItemImage } from "../../components/shop/ShopParts.jsx";
import { useParam } from "../../lib/admin.js";
import { getAdminShopOrders } from "../../lib/endpoints.js";
import { formatDay } from "../../lib/projects.js";
import { ORDER_STATUS, regionName } from "../../lib/shop.js";
import { useApi } from "../../lib/useApi.js";

const MAX_ORDERS = 200;

const STATUS_OPTIONS = [["", "Waiting to ship"], ["fulfilled", "Shipped"], ["refunded", "Refunded"], ["all", "Any"]];
const SORT_OPTIONS = [["", "Oldest first"], ["newest", "Newest first"]];

// /admin/shop/orders — the fulfilment queue: orders waiting to ship, oldest
// first, so whoever's been waiting longest goes out next.
export default function AdminShopOrders() {
    return (
        <AdminShell title="Orders">
            <OrderQueue />
        </AdminShell>
    );
}

function OrderQueue() {
    const [status] = useParam("status");
    const [sort] = useParam("sort");
    const fetchOrders = useCallback(() => getAdminShopOrders({ status, sort }), [status, sort]);
    const orders = useApi(fetchOrders);

    return (
        <div className="flex flex-col gap-6">
            <Toolbar>
                <FilterSelect name="status" label="Status" options={STATUS_OPTIONS} />
                <FilterSelect name="sort" label="Order" options={SORT_OPTIONS} />
            </Toolbar>
            <ResultList
                api={orders}
                label="orders"
                cap={MAX_ORDERS}
                capNote={`Showing the first ${MAX_ORDERS}. Ship some, or switch the order, to see the rest.`}
                empty={!status
                    ? { title: "Nothing waiting to ship", text: "New orders land here the moment a builder places one." }
                    : { title: "No orders here", text: "Nothing matches this filter yet." }}
            >
                {(o) => <OrderRow key={o.id} order={o} />}
            </ResultList>
        </div>
    );
}

function OrderRow({ order: o }) {
    return (
        <ResultRow
            to={`/admin/shop/orders/${o.id}`}
            lead={<ItemImage src={o.imageUrl} className="size-10 rounded-[0.625rem] border-2 border-white/15" />}
            title={`${o.quantity > 1 ? `${o.quantity}× ` : ""}${o.itemName}${o.variantName ? ` · ${o.variantName}` : ""}`}
            meta={[o.username || "unknown", `Ordered ${formatDay(o.createdAt)}`, regionName(o.region)].join(" · ")}
            trail={
                <>
                    {o.status !== "pending" && <Tag>{ORDER_STATUS[o.status]}</Tag>}
                    {o.viaDaily && (
                        <span title="Bought as the random item of the day" className="inline-flex items-center gap-1">
                            <Shuffle aria-hidden="true" className="size-3.5" />
                            Random item
                        </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                        <Zap aria-hidden="true" className="size-3.5 text-(--accent)" />
                        {o.totalPrice.toLocaleString()}
                    </span>
                </>
            }
        />
    );
}
