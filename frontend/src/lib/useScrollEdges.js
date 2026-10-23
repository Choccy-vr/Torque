import { useLayoutEffect, useState } from "react";

// Whether a horizontal scroller has more content before ({ start }) and after
// ({ end }) what's in view. Re-checked on scroll, resize and new `content`.
export function useScrollEdges(ref, content) {
    const [edges, setEdges] = useState({ start: false, end: false });

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const update = () => {
            const start = el.scrollLeft > 1;
            const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
            setEdges((e) => (e.start === start && e.end === end ? e : { start, end }));
        };
        update();
        el.addEventListener("scroll", update, { passive: true });
        const observer = new ResizeObserver(update);
        observer.observe(el);
        return () => {
            el.removeEventListener("scroll", update);
            observer.disconnect();
        };
    }, [ref, content]);

    return edges;
}
