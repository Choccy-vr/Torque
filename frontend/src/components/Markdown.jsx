import { Square, SquareCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renders admin-written markdown (announcements) in the app's reading style.
// Safe by default: react-markdown never renders raw HTML, and its URL
// transform drops javascript:/data: links. `preview` is for a clipped glimpse
// inside a clickable tile: nothing in it can take focus or be clicked, and
// headings drop to body size so they don't compete with the tile's title.
export default function Markdown({ children, preview = false, className = "" }) {
    return (
        <div className={`flex max-w-[70ch] flex-col gap-3 leading-relaxed break-words text-(--text)/90 ${className}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={preview ? PREVIEW_COMPONENTS : COMPONENTS}>
                {children}
            </ReactMarkdown>
        </div>
    );
}

// react-markdown passes each element its syntax-tree `node`; keep it off the DOM.
function withoutNode(props) {
    const rest = { ...props };
    delete rest.node;
    return rest;
}

// A markdown element drawn as `Tag` with fixed classes.
const styled = (Tag, className) =>
    function Styled(props) {
        return <Tag className={className} {...withoutNode(props)} />;
    };

// Posts sit under an h3 title, so h1/h2 become h4 and h3+ become h5: a post
// can't out-shout its own title.
const BIG_HEADING = styled("h4", "mt-2 text-lg font-bold text-balance text-(--text)");
const SMALL_HEADING = styled("h5", "mt-1 font-bold text-(--text)");

const COMPONENTS = {
    h1: BIG_HEADING,
    h2: BIG_HEADING,
    h3: SMALL_HEADING,
    h4: SMALL_HEADING,
    h5: SMALL_HEADING,
    h6: SMALL_HEADING,
    // Chalk White with a coral underline: coral itself fails as reading text.
    a: function Link(props) {
        const { href, ...rest } = withoutNode(props);
        const external = /^https?:\/\//i.test(href ?? "");
        return (
            <a
                href={href}
                {...(external && { target: "_blank", rel: "noreferrer" })}
                className="rounded-sm font-medium text-(--text) underline decoration-(--accent) decoration-2 underline-offset-4 transition-all duration-300 ease hover:bg-white/10"
                {...rest}
            />
        );
    },
    strong: styled("strong", "font-bold text-(--text)"),
    ul: styled("ul", "flex list-disc flex-col gap-1 pl-6 marker:text-(--accent)"),
    // Numerals are reading text, so Chalk White; coral would fail contrast.
    ol: styled("ol", "flex list-decimal flex-col gap-1 pl-6 marker:font-bold marker:text-(--text)/85"),
    li: styled("li", "pl-1 [&>ol]:mt-1 [&>ul]:mt-1 [&.task-list-item]:-ml-6 [&.task-list-item]:list-none [&.task-list-item]:pl-0"),
    blockquote: styled("blockquote", "flex flex-col gap-3 border-l-2 border-white/25 pl-4 text-(--text)/80"),
    hr: function Rule() {
        return <hr className="my-1 h-0.5 rounded-full border-0 bg-white/15" />;
    },
    // Fenced code carries a language-* class and sits inside <pre>; inline code doesn't.
    code: function Code(props) {
        const { className, ...rest } = withoutNode(props);
        return className
            ? <code className={`${className} font-mono text-sm`} {...rest} />
            : <code className="rounded-md bg-(--bg)/70 px-1.5 py-0.5 font-mono text-[0.875em] text-(--text)" {...rest} />;
    },
    pre: styled("pre", "t-scroll overflow-x-auto rounded-2xl border-2 border-white/10 bg-(--bg)/70 px-4 py-3 font-mono text-sm leading-relaxed text-(--text) [&_code]:bg-transparent [&_code]:p-0"),
    img: function Image(props) {
        const { alt, ...rest } = withoutNode(props);
        return <img alt={alt ?? ""} loading="lazy" className="max-h-96 rounded-xl border-2 border-white/15 bg-(--bg) object-contain" {...rest} />;
    },
    table: function Table(props) {
        return (
            <div className="t-scroll overflow-x-auto rounded-2xl border-2 border-white/10">
                <table className="w-full border-collapse text-left text-[0.9375rem] tabular-nums" {...withoutNode(props)} />
            </div>
        );
    },
    th: styled("th", "bg-(--accent)/15 px-3 py-2 font-bold text-(--text)"),
    td: styled("td", "border-t-2 border-white/10 px-3 py-2"),
    // GFM task lists render read-only checkboxes; draw them as icons instead
    // of greyed-out native controls.
    input: function Checkbox(props) {
        const { type, checked } = withoutNode(props);
        if (type !== "checkbox") return null;
        const Icon = checked ? SquareCheck : Square;
        return (
            <>
                <Icon aria-hidden="true" className={`mr-2 -mt-0.5 inline size-4.5 align-middle ${checked ? "text-(--accent)" : "text-(--text)/70"}`} />
                <span className="sr-only">{checked ? "Done: " : "To do: "}</span>
            </>
        );
    },
};

const PREVIEW_HEADING = styled("p", "font-semibold text-(--text)");

const PREVIEW_COMPONENTS = {
    ...COMPONENTS,
    h1: PREVIEW_HEADING,
    h2: PREVIEW_HEADING,
    h3: PREVIEW_HEADING,
    h4: PREVIEW_HEADING,
    h5: PREVIEW_HEADING,
    h6: PREVIEW_HEADING,
    a: styled("span", "font-medium text-(--text) underline decoration-(--accent) decoration-2 underline-offset-4"),
    img: () => null,
    // No scroller in a preview: a scrollable <pre> or table would take focus.
    pre: styled("pre", "overflow-hidden rounded-2xl border-2 border-white/10 bg-(--bg)/70 px-4 py-3 font-mono text-sm leading-relaxed text-(--text) [&_code]:bg-transparent [&_code]:p-0"),
    table: function PreviewTable(props) {
        return (
            <div className="overflow-hidden rounded-2xl border-2 border-white/10">
                <table className="w-full border-collapse text-left text-[0.9375rem] tabular-nums" {...withoutNode(props)} />
            </div>
        );
    },
};
