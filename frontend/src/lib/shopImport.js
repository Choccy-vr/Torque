// Parses the admin "bulk add" paste into item bodies for POST
// api/admin/shop/items/bulk. Accepts a JSON array of items as the API takes
// them, or CSV with a header row. CSV columns (any order, case-insensitive;
// only name, tier and price are required):
//
//   name, description, imageUrl, tier, price, stock, maxPerUser, randomMode,
//   regions, regionPrices, variants, sortOrder, active, fulfillerNotes
//
//   regions       US;EU;UK, or blank / "all" for every region
//   regionPrices  US=120;IN=80
//   variants      name:priceDelta:stock separated by |, e.g. 32 GB:0:10|64 GB:40:5
//                 (blank stock = unlimited)
//   stock, maxPerUser  blank = unlimited / no limit
//   randomMode    eligible (default) | random_only | never
//   active        true (default) | false

import { REGIONS } from "./shop.js";

const ALL_REGIONS = REGIONS.map(([code]) => code);

export const CSV_HEADER = "name,description,imageUrl,tier,price,stock,maxPerUser,randomMode,regions,regionPrices,variants";

// → { rows: [{ item, error }] } or { error } when the paste can't be read at all.
export function parseBulk(text) {
    const trimmed = text.trim();
    if (!trimmed) return { rows: [] };

    if (trimmed.startsWith("[")) {
        let data;
        try {
            data = JSON.parse(trimmed);
        } catch (err) {
            return { error: `That isn't valid JSON: ${err.message}` };
        }
        if (!Array.isArray(data)) return { error: "JSON must be an array of items." };
        return { rows: data.map((item) => ({ item, error: item && typeof item === "object" ? null : "Not an item object." })) };
    }

    const table = parseCsv(trimmed);
    if (table.length < 2) return { error: "Paste a header row, then one row per item." };

    const header = table[0].map((h) => h.trim().toLowerCase());
    if (!header.includes("name")) return { error: `The header row needs a "name" column. Expected columns: ${CSV_HEADER}` };
    const col = (row, name) => (row[header.indexOf(name.toLowerCase())] ?? "").trim();

    return {
        rows: table
            .slice(1)
            .filter((row) => row.some((cell) => cell.trim()))
            .map((row) => {
                try {
                    return { item: rowToItem((name) => col(row, name)), error: null };
                } catch (err) {
                    return { item: { name: col(row, "name") }, error: err.message };
                }
            }),
    };
}

function rowToItem(get) {
    const regionsText = get("regions");
    const regions = !regionsText || regionsText.toLowerCase() === "all"
        ? ALL_REGIONS
        : regionsText.split(/[;\s]+/).filter(Boolean).map((r) => r.toUpperCase());

    const regionalPrices = {};
    for (const pair of get("regionPrices").split(";").map((p) => p.trim()).filter(Boolean)) {
        const [region, price] = pair.split("=").map((p) => p.trim());
        if (!region || price === undefined) throw new Error(`Regional price "${pair}" should look like US=120.`);
        regionalPrices[region.toUpperCase()] = int(price, `Regional price for ${region}`);
    }

    const variants = get("variants")
        .split("|")
        .map((v) => v.trim())
        .filter(Boolean)
        .map((v, i) => {
            const [name, delta = "0", stock = ""] = v.split(":").map((p) => p.trim());
            if (!name) throw new Error(`Option ${i + 1} has no name.`);
            return { name, priceDelta: int(delta || "0", `Price change for "${name}"`), stock: optionalInt(stock, `Stock for "${name}"`), sortOrder: i };
        });

    const active = get("active").toLowerCase();
    return {
        name: get("name"),
        description: get("description"),
        imageUrl: get("imageUrl") || null,
        tier: optionalInt(get("tier"), "Tier"),
        price: optionalInt(get("price"), "Price"),
        stock: optionalInt(get("stock"), "Stock"),
        maxPerUser: optionalInt(get("maxPerUser"), "Max per user"),
        randomMode: get("randomMode") || "eligible",
        regions,
        regionalPrices,
        variants,
        sortOrder: optionalInt(get("sortOrder"), "Sort order") ?? 0,
        isActive: active !== "false" && active !== "no" && active !== "0",
        fulfillerNotes: get("fulfillerNotes") || null,
    };
}

function int(text, label) {
    if (!/^-?\d+$/.test(text)) throw new Error(`${label} must be a whole number (got "${text}").`);
    return Number(text);
}

function optionalInt(text, label) {
    return text === "" ? null : int(text, label);
}

// RFC 4180-ish: quoted fields may hold commas, newlines and "" escapes.
function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
            else if (c === '"') quoted = false;
            else field += c;
        } else if (c === '"') quoted = true;
        else if (c === ",") { row.push(field); field = ""; }
        else if (c === "\n" || c === "\r") {
            if (c === "\r" && text[i + 1] === "\n") i++;
            row.push(field); rows.push(row);
            row = []; field = "";
        } else field += c;
    }
    row.push(field);
    rows.push(row);
    return rows;
}
