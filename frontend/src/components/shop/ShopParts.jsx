import { useState } from "react";
import { Package, Zap } from "lucide-react";

// Small pieces shared by the shop page, its checkout and the admin pages.

// An item's photo in a slate well, or a gridded placeholder when it has none
// (or it fails to load). `className` sets the size / aspect.
export function ItemImage({ src, className = "" }) {
    const [failed, setFailed] = useState(false);

    if (src && !failed) {
        return (
            <img
                src={src}
                alt=""
                loading="lazy"
                decoding="async"
                onError={() => setFailed(true)}
                className={`shrink-0 bg-(--bg) object-contain ${className}`}
            />
        );
    }

    return (
        <div
            aria-hidden="true"
            className={`flex shrink-0 items-center justify-center bg-(--bg)/45 ${className}`}
            style={{
                backgroundImage:
                    "linear-gradient(rgb(255 255 255 / 0.07) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.07) 1px, transparent 1px)",
                backgroundSize: "11px 11px",
            }}
        >
            <Package className="size-1/3 max-h-10 max-w-10 text-(--text)/45" strokeWidth={1.5} />
        </div>
    );
}

// A Volts amount: coral bolt, tabular figures. `size` is a text-size class.
// `muted` drops the coral for prices that can't be paid right now (locked,
// out of stock, not shipping to you): coral only marks what's live.
export function Volts({ amount, size = "", className = "", muted = false }) {
    return (
        <span className={`inline-flex items-center gap-1 font-semibold whitespace-nowrap tabular-nums ${size} ${className}`}>
            <Zap aria-hidden="true" className={`size-[0.95em] shrink-0 ${muted ? "text-(--text)/60" : "text-(--accent)"}`} />
            {amount.toLocaleString()}
            <span className="sr-only"> Volts</span>
        </span>
    );
}
