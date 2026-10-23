import { useEffect, useState } from "react";

// Shop vocabulary shared by the shop page, the checkout and the admin pages.

// Shipping regions, in the order the backend lists them (ShopRegions.All).
export const REGIONS = [
    ["US", "United States"],
    ["CA", "Canada"],
    ["EU", "European Union"],
    ["UK", "United Kingdom"],
    ["IN", "India"],
    ["AU", "Australia"],
    ["XX", "Rest of world"],
];
export const regionName = (code) => REGIONS.find(([c]) => c === code)?.[1] ?? code;

export const RANDOM_MODES = [
    ["eligible", "Listed, and can be the random item"],
    ["random_only", "Only as the random item of the day"],
    ["never", "Listed, never the random item"],
];

export const ORDER_STATUS = {
    pending: "Waiting to ship",
    fulfilled: "Shipped",
    refunded: "Refunded",
};

export const formatVolts = (n) => `${n.toLocaleString()} Volts`;

// What's left: "12 left", "Last one", "Out of stock", or nothing when unlimited.
export function stockText(stock) {
    if (stock == null) return null;
    if (stock <= 0) return "Out of stock";
    if (stock === 1) return "Last one";
    return `${stock.toLocaleString()} left`;
}

// Short label for why an item can't be bought (ShopService.Reasons). The full
// sentence comes from the server as unavailableMessage.
export const REASON_LABEL = {
    inactive: "Unavailable",
    random_only: "Random item only",
    locked_tier: "Locked",
    region_unavailable: "Doesn't ship to you",
    out_of_stock: "Out of stock",
    limit_reached: "Limit reached",
    insufficient_volts: "Not enough Volts",
};

// Ticks once a second until `until` (an ISO time), returning the time left as
// "HH:MM:SS", and calls `onDone` once it passes (the daily item rotated).
export function useCountdown(until, onDone) {
    const [now, setNow] = useState(() => Date.now());
    const end = until ? new Date(until).getTime() : null;

    useEffect(() => {
        if (!end) return;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [end]);

    const left = end ? Math.max(0, end - now) : 0;
    useEffect(() => {
        if (end && left === 0) onDone?.();
    }, [end, left === 0]); // eslint-disable-line react-hooks/exhaustive-deps

    const total = Math.floor(left / 1000);
    const pad = (n) => String(n).padStart(2, "0");
    return {
        left,
        text: `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`,
        label: `${Math.floor(total / 3600)} hours ${Math.floor((total % 3600) / 60)} minutes`,
    };
}
