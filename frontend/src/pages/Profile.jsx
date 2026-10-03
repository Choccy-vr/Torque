import AppShell, { PageTitle } from "../components/AppShell.jsx";

export default function Profile() {
    return (
        <AppShell title="Profile">
            <PageTitle>Profile</PageTitle>
            <div className="p-4">
                <h1 className="t-heading text-3xl font-bold mb-4">Profile</h1>
                <p className="text-lg">This is the profile page.</p>
            </div>
        </AppShell>
    );
}