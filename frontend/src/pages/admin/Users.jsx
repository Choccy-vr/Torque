import { useCallback } from "react";
import { Ban, Eye, Zap } from "lucide-react";
import AdminShell from "../../components/admin/AdminShell.jsx";
import { ResultList, ResultRow, SearchField, Tag, Toolbar } from "../../components/admin/AdminParts.jsx";
import { useParam } from "../../lib/admin.js";
import { searchAdminUsers } from "../../lib/endpoints.js";
import { formatDay } from "../../lib/projects.js";
import { useApi } from "../../lib/useApi.js";
import { Avatar as BaseAvatar } from "../../components/EmptyImage.jsx";

// /admin/users — find anyone by username, name, email, Slack or Hackatime id.
export default function AdminUsers() {
    return (
        <AdminShell title="Users">
            <UserSearch />
        </AdminShell>
    );
}

function UserSearch() {
    const [q] = useParam("q");
    const fetchUsers = useCallback(() => searchAdminUsers(q), [q]);
    const users = useApi(fetchUsers);

    return (
        <div className="flex flex-col gap-6">
            <Toolbar>
                <SearchField label="Search users" placeholder="Username, name, email, Slack or user id" />
            </Toolbar>
            <ResultList
                api={users}
                label="users"
                empty={q
                    ? { title: "No one matches", text: `Nobody's username, name, email or ids contain "${q}".` }
                    : { title: "No users yet", text: "People show up here the first time they sign in." }}
            >
                {(u) => (
                    <ResultRow
                        key={u.id}
                        to={`/admin/users/${u.id}`}
                        lead={<Avatar src={u.profilePictureUrl} />}
                        title={u.username || u.name || "No username yet"}
                        meta={[u.name, u.email].filter(Boolean).join(" · ")}
                        trail={<UserTags user={u} />}
                    />
                )}
            </ResultList>
        </div>
    );
}

export function UserTags({ user }) {
    const roles = (user.role ?? []).filter((r) => r !== "banned");
    return (
        <>
            {user.role?.includes("banned") && <Tag accent><Ban aria-hidden="true" className="size-3.5" />Banned</Tag>}
            {user.watchlisted && <Tag accent><Eye aria-hidden="true" className="size-3.5" />Watchlist</Tag>}
            {roles.map((r) => <Tag key={r}>{r[0].toUpperCase() + r.slice(1)}</Tag>)}
            <span className="inline-flex items-center gap-1">
                <Zap aria-hidden="true" className="size-3.5 text-(--accent)" />
                {user.volts.toLocaleString()}
            </span>
            {user.createdAt && <span className="text-(--text)/75">Joined {formatDay(user.createdAt)}</span>}
        </>
    );
}

// `className` sets size, corners and edge colour (row size by default).
export function Avatar({ src, className = "size-10 rounded-[0.625rem] border-(--accent)/55" }) {
    return <BaseAvatar src={src} className={className} />;
}
