import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CircleX, Hash } from "lucide-react";
import AdminShell from "../../components/admin/AdminShell.jsx";
import { FilterSelect, ResultList, SearchField, Tag, Toolbar } from "../../components/admin/AdminParts.jsx";
import { Avatar } from "../../components/EmptyImage.jsx";
import { FOCUS } from "../../components/Form.jsx";
import { useParam } from "../../lib/admin.js";
import { getAdminSlackLogs } from "../../lib/endpoints.js";
import { formatWhen } from "../../lib/projects.js";
import { useApi } from "../../lib/useApi.js";

// The backend caps the log here.
const MAX_LOGS = 100;

// "type" and "result" are this page's own URL params, mapped to the API's
// action / success so the default (DMs, any result) keeps a clean URL.
const TYPE_OPTIONS = [["", "DMs"], ["invites", "Channel invites"], ["all", "Both"]];
const RESULT_OPTIONS = [["", "Any"], ["sent", "Delivered"], ["failed", "Failed"]];
const actionFor = (type) => (type === "all" ? undefined : type === "invites" ? "channel_invite" : "dm");
const successFor = (result) => (result === "sent" ? true : result === "failed" ? false : undefined);

// The bot escapes user text the Slack way before sending; undo it for display.
const unescapeSlack = (text) => text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

function emptyFor({ q, type, result }) {
    if (result === "failed" && !q) return { title: "No failures", text: "Everything the bot tried to send went through." };
    if (q || type || result) return { title: "Nothing matches", text: "Try a different search, or clear the filters." };
    return { title: "No DMs yet", text: "Every DM the bot sends (onboarding, ships, reviews, streaks, nudges, shop orders) shows up here the moment it goes out." };
}

// /admin/slack — everything the Slack bot tried to send (onboarding, ships,
// reviews, streaks, nudges, shop), newest first, failures marked.
export default function AdminSlack() {
    return (
        <AdminShell title="Slack DMs">
            <SlackLog />
        </AdminShell>
    );
}

function SlackLog() {
    const [q] = useParam("q");
    const [type] = useParam("type");
    const [result] = useParam("result");
    const fetchLogs = useCallback(
        () => getAdminSlackLogs({ q, action: actionFor(type), success: successFor(result) }),
        [q, type, result],
    );
    const logs = useApi(fetchLogs);

    return (
        <div className="flex flex-col gap-6">
            <Toolbar>
                <SearchField label="Search Slack messages" placeholder="Username, Slack ID or message text" />
                <FilterSelect name="type" label="Showing" options={TYPE_OPTIONS} />
                <FilterSelect name="result" label="Result" options={RESULT_OPTIONS} />
            </Toolbar>
            <ResultList
                api={logs}
                label="Slack messages"
                cap={MAX_LOGS}
                capNote={`Showing the newest ${MAX_LOGS}. Search or filter to find older ones.`}
                empty={emptyFor({ q, type, result })}
            >
                {(log) => <LogRow key={log.id} log={log} />}
            </ResultList>
        </div>
    );
}

function LogRow({ log }) {
    const isDm = log.action === "dm";
    const alreadyIn = !isDm && log.success && log.error === "already_in_channel";

    return (
        <li className="flex gap-4 px-5 py-4 sm:px-6">
            <Avatar src={log.profilePictureUrl} className="size-10 rounded-[0.625rem] border-(--accent)/55" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <Recipient log={log} />
                    <div className="flex flex-wrap items-center gap-2 text-sm text-(--text)/80 tabular-nums sm:justify-end">
                        {!log.success && (
                            <Tag accent>
                                <CircleX aria-hidden="true" className="size-3.5" />
                                Failed{log.error && <code className="font-mono text-[0.75rem]">{log.error}</code>}
                            </Tag>
                        )}
                        {alreadyIn && <Tag>Already in channel</Tag>}
                        <time dateTime={log.createdAt}>{formatWhen(log.createdAt)}</time>
                    </div>
                </div>
                {isDm ? (
                    <Message text={unescapeSlack(log.detail)} />
                ) : (
                    <p className="flex flex-wrap items-center gap-1.5 text-(--text)/90">
                        <Hash aria-hidden="true" className="size-4 text-(--text)/70" />
                        Invited to channel
                        <code className="font-mono text-[0.8125rem] text-(--text)/85 select-all">{log.detail}</code>
                    </p>
                )}
            </div>
        </li>
    );
}

// The Torque account the message went to, or the bare Slack ID when no
// account has it.
function Recipient({ log }) {
    if (!log.userId) {
        return (
            <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-(--text)">
                <code className="font-mono text-[0.9375rem] font-semibold select-all">{log.slackUserId}</code>
                <span className="text-sm text-(--text)/75">No Torque account</span>
            </p>
        );
    }
    return (
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <Link
                to={`/admin/users/${log.userId}`}
                className={`truncate rounded font-semibold text-(--text) underline decoration-white/30 decoration-2 underline-offset-4 transition-colors duration-300 ease hover:decoration-(--accent) ${FOCUS}`}
            >
                {log.username || "Unknown user"}
            </Link>
            <code className="font-mono text-[0.8125rem] text-(--text)/70 select-all">{log.slackUserId}</code>
        </p>
    );
}

// The DM's notification text (its one-line summary; the full Slack layout
// isn't logged). Long ones fold to three lines with a toggle, only when they
// actually overflow.
function Message({ text }) {
    const ref = useRef(null);
    const [open, setOpen] = useState(false);
    const [overflows, setOverflows] = useState(false);

    useLayoutEffect(() => {
        const el = ref.current;
        if (el && !open) setOverflows(el.scrollHeight > el.clientHeight + 1);
    }, [text, open]);

    return (
        <div className="flex flex-col items-start gap-1">
            <p
                ref={ref}
                className={`max-w-[75ch] leading-relaxed break-words whitespace-pre-wrap text-(--text)/90 ${open ? "" : "line-clamp-3"}`}
            >
                {text}
            </p>
            {(overflows || open) && (
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    aria-expanded={open}
                    className={`-mx-2 inline-flex min-h-9 items-center rounded-lg px-2 text-sm font-medium text-(--text) underline decoration-(--accent) decoration-2 underline-offset-4 transition-colors duration-300 ease hover:bg-white/10 ${FOCUS}`}
                >
                    {open ? "Show less" : "Show all"}
                </button>
            )}
        </div>
    );
}
