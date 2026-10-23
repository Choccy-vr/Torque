import { useState } from "react";
import { Image } from "lucide-react";

// Stand-ins for pictures that don't exist yet. They should read as "nothing
// here", the way other sites do it (a grey silhouette, an empty photo frame),
// not as a broken image or someone else's picture.

// A user's profile picture, or a head-and-shoulders silhouette on a slate
// well when they have none (or it fails to load). `className` sets size,
// corners and edge colour; the edge is always 2px.
export function Avatar({ src, className = "" }) {
    const [failed, setFailed] = useState(false);

    if (src && !failed) {
        return (
            <img
                src={src}
                alt=""
                onError={() => setFailed(true)}
                className={`${className} shrink-0 border-2 bg-(--bg) object-cover`}
            />
        );
    }

    return (
        <span aria-hidden="true" className={`${className} block shrink-0 overflow-hidden border-2 bg-(--bg)`}>
            <svg viewBox="0 0 40 40" className="size-full text-(--text)/30" fill="currentColor">
                <circle cx="20" cy="15.5" r="7.5" />
                <path d="M4.5 42c0-9.4 6.9-15.5 15.5-15.5S35.5 32.6 35.5 42z" />
            </svg>
        </span>
    );
}

// A project's cover in an image well, or an empty frame when it has none: a
// dashed outline on the drawing plate with a faint picture glyph, the same
// "waiting to be filled in" outline the empty states use. `className` sizes
// the well, `frame` places and rounds the dashed outline inside it (null for
// none), and
// `label` adds a short caption under the glyph where there's room.
export function CoverImage({ src, className = "", imgClassName = "", label = false, frame = "inset-1.5 rounded-md" }) {
    const [failed, setFailed] = useState(false);

    if (src && !failed) {
        return (
            <div className={`t-plate overflow-hidden ${className}`}>
                <img
                    src={src}
                    alt=""
                    loading="lazy"
                    onError={() => setFailed(true)}
                    className={`size-full object-cover ${imgClassName}`}
                />
            </div>
        );
    }

    // Tiny tiles (`frame={null}`) skip the outline; it would crowd the glyph.
    if (!frame) {
        return (
            <div aria-hidden="true" className={`t-plate relative ${className}`}>
                <Image className="absolute inset-0 m-auto size-1/2 max-h-6 max-w-6 text-(--text)/45" strokeWidth={1.5} />
            </div>
        );
    }

    return (
        <div aria-hidden="true" className={`t-plate relative overflow-hidden ${className}`}>
            <div className={`@container absolute ${frame} flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-white/20 px-3 text-center`}>
                <Image className={`${label ? "size-7" : "size-6"} text-(--text)/45`} strokeWidth={1.5} />
                {/* The caption drops out where the well is too small to hold it. */}
                {label && <span className="hidden text-sm font-medium text-(--text)/75 @[10rem]:block">No cover photo yet</span>}
            </div>
        </div>
    );
}
