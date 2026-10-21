import { useCallback, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getBanStatus, getMyProfile } from "../lib/endpoints.js";
import Banned from "../pages/Banned.jsx";
import { CALLBACK_PATH } from "../lib/hackatimePending.js";

const ALLOWED_WHILE_ONBOARDING = ["/onboarding", CALLBACK_PATH];

// Sends signed-in users who haven't finished first-time setup to /onboarding.
// "Finished" is the backend's completedFirstTimeSetup, set by api/user/me/onboarding.
// The onboarding modal calls `markOnboarded` from the outlet context when it's done.
// A banned account gets the Banned page instead of anything here but the docs.
export default function RequireOnboarding({ user, loading }) {
    const { pathname } = useLocation();
    const userId = user?.id ?? null;
    // { userId, onboarded } for the user it was checked for; anything else is still loading.
    const [checked, setChecked] = useState(null);

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        getMyProfile()
            .then((profile) => !cancelled && setChecked({ userId, onboarded: Boolean(profile.completedFirstTimeSetup) }))
            .catch(async (err) => {
                // A 403 here is almost always a ban; ask to be sure.
                const banned = err?.status === 403 && (await getBanStatus().catch(() => null))?.banned === true;
                // Backend unreachable: don't lock anyone out of the site over it.
                if (!cancelled) setChecked({ userId, onboarded: true, banned });
            });
        return () => { cancelled = true; };
    }, [userId]);

    const markOnboarded = useCallback(() => setChecked({ userId, onboarded: true }), [userId]);

    if (loading) return null;
    if (!user) return <Outlet />; // signed out: RequireAuth handles protected routes
    if (checked?.userId !== userId) return null;
    if (checked.banned) return pathname.startsWith("/docs") ? <Outlet /> : <Banned />;

    if (checked.onboarded) {
        return pathname === "/onboarding"
            ? <Navigate to="/home" replace />
            : <Outlet />;
    }

    return ALLOWED_WHILE_ONBOARDING.includes(pathname)
        ? <Outlet context={{ markOnboarded }} />
        : <Navigate to="/onboarding" replace />;
}
