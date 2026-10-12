import { useState } from "react";
import { ImageOff } from "lucide-react";
import { FOCUS } from "../Form.jsx";

// The band across the top of a project card: its cover image, or a gridded
// "No cover image" sheet (with an add button for the owner, via `onAdd`).
// Also the live preview on the new-project page (`emptyText` replaces
// "No cover image" there).
export default function Cover({ project, onAdd, emptyText = "No cover image" }) {
    const [failed, setFailed] = useState(false);

    if (project.coverImageUrl && !failed) {
        return (
            <img
                src={project.coverImageUrl}
                alt={`Cover image for ${project.title}`}
                onError={() => setFailed(true)}
                className="aspect-[21/9] max-h-96 w-full border-b-2 border-(--accent)/55 bg-(--bg) object-cover object-center"
            />
        );
    }

    return (
        <div
            className="flex min-h-36 flex-col items-center justify-center gap-2 border-b-2 border-dashed border-white/20 bg-(--bg)/45 px-6 py-6 text-center sm:min-h-44"
            style={{
                backgroundImage:
                    "linear-gradient(rgb(255 255 255 / 0.07) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.07) 1px, transparent 1px)",
                backgroundSize: "22px 22px",
            }}
        >
            <ImageOff aria-hidden="true" className="size-6 text-(--text)/80" />
            <p className="font-medium text-(--text)/85">{failed ? "Cover image couldn't load" : emptyText}</p>
            {onAdd && (
                <button
                    type="button"
                    onClick={onAdd}
                    className={`inline-flex min-h-11 items-center rounded-(--radius) px-3 font-medium text-(--text) underline decoration-(--accent) decoration-2 underline-offset-4 transition-all duration-300 ease hover:bg-white/10 ${FOCUS}`}
                >
                    {failed ? "Change cover image" : "Add a cover image"}
                </button>
            )}
        </div>
    );
}
