import { Navigate, Outlet, useLocation } from "react-router-dom";
import { CALLBACK_PATH } from "../lib/hackatimePending.js";

const ALLOWED_WHILE_ONBOARDING = ["/onboarding", CALLBACK_PATH];

export default function RequireOnboarding({ user, loading }) {
    const { pathname } = useLocation();

    if (loading) return null;
    if (!user) return <Outlet />; // signed out: RequireAuth handles protected routes

    const onboarded = Boolean(user.user_metadata?.onboarded);

    if (onboarded) {
        return pathname === "/onboarding"
            ? <Navigate to="/home" replace />
            : <Outlet />;
    }

    return ALLOWED_WHILE_ONBOARDING.includes(pathname)
        ? <Outlet />
        : <Navigate to="/onboarding" replace />;
}