import logo from "../assets/logo.png";

// Whole-page messages for when there's nothing to show: a 404, a crash, a ban.
// `StatusMessage` is the panel itself: an optional illustration drawn on a
// gridded plate, a Phantom headline, a sentence or two and the ways out.
// `StatusFrame` puts one on the blueprint grid on its own, for pages that
// can't (or shouldn't) offer the app's navigation.

// `art` is { src, alt, width, height, drive }: `drive` slides it in from the
// left, like Orpheus' car pulling up. `icon` is the alternative for screens
// that shouldn't be playful; it's drawn neutral, never as an alarm.
// The headline is Chalk White with the coral redline under it: coral text on
// the card would only be 2.74:1.
export function StatusMessage({ art, icon: Icon, title, children, actions, details }) {
    return (
        <section
            aria-labelledby="status-title"
            className={`t-card grid overflow-hidden text-(--text)! ${art ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" : "mx-auto max-w-2xl"}`}
        >
            {art && (
                <div className="t-plate flex items-center justify-center border-b-2 border-white/10 px-6 py-8 md:border-r-2 md:border-b-0 md:px-8">
                    <img
                        src={art.src}
                        alt={art.alt}
                        width={art.width}
                        height={art.height}
                        className={`h-auto max-h-64 w-full max-w-sm object-contain md:max-h-80 ${art.drive ? "t-drive-in" : ""}`}
                    />
                </div>
            )}

            <div className="flex flex-col items-start gap-4 px-6 py-8 sm:px-10 sm:py-10">
                {Icon && (
                    <span className="inline-flex size-14 items-center justify-center rounded-[1.25rem] border-2 border-white/25 bg-(--bg)">
                        <Icon aria-hidden="true" className="size-7 text-(--text)/90" />
                    </span>
                )}
                <h1 id="status-title" className="[font-family:var(--heading-font)] text-4xl leading-[1.1] font-bold text-balance text-(--text) lg:text-5xl">
                    {title}
                </h1>
                <div aria-hidden="true" className="-mt-1 h-1 w-14 rounded-full bg-(--accent)" />
                <div className="flex max-w-[52ch] flex-col gap-3 text-lg leading-relaxed text-pretty text-(--text)/90">
                    {children}
                </div>
                {actions && <div className="mt-2 flex flex-wrap gap-3">{actions}</div>}
                {details}
            </div>
        </section>
    );
}

export function StatusFrame({ title, children }) {
    return (
        <div className="t-shell relative min-h-screen bg-(--bg)">
            <title>{`Torque - ${title}`}</title>
            <div className="t-bg fixed inset-0 z-0" />
            <div className="fixed inset-0 z-0 bg-black/20 opacity-(--overlay)" />

            <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6 sm:py-10">
                <a href="/" className="self-start rounded-xl p-1 transition-opacity duration-300 ease hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-(--text)">
                    <img src={logo} alt="Torque home" width={2172} height={724} className="h-10 w-auto sm:h-12" />
                </a>
                <main className="flex flex-1 items-center py-10">
                    <div className="w-full">{children}</div>
                </main>
            </div>
        </div>
    );
}

// Inline code in status copy (a mistyped path), drawn like the docs' code.
export function Path({ children }) {
    return (
        <code className="rounded-md bg-(--bg)/70 px-1.5 py-0.5 font-mono text-[0.9em] break-all text-(--text)">{children}</code>
    );
}
