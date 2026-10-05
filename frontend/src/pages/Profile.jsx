import AppShell, { PageTitle } from "../components/AppShell.jsx";
import profilepic from "../assets/img.png";

export default function Profile() {
    return (
        <AppShell title="Profile">
            <PageTitle>Account</PageTitle>
            <section
                aria-labelledby="your-profile"
                className="t-card relative mt-6 flex min-h-72 flex-col gap-2 px-5 py-6 sm:px-8 md:mt-8 md:min-h-84 lg:px-12"
            >
                <h2 id="your-profile" className="text-2xl font-bold text-(--text)">Profile</h2>

                <div className="w-full h-0.5 bg-white opacity-50"></div>

                <div className="flex flex-row items-center justify-between h-full w-full">
                    <div className="flex grow flex-col justify-center text-center text-(--text)">
                        <div className="text-left mt-4">
                            <p className="m-0 text-sm opacity-80">Name:</p>
                            <p className="m-0 text-md font-bold">John Doe</p>
                        </div>

                        <div className="text-left mt-4 ">
                            <p className="m-0 text-sm opacity-80">Email:</p>
                            <p className="m-0 text-md font-bold">john@example.com</p>
                        </div>

                        <div className="text-left mt-4">
                            <p className="m-0 text-sm opacity-80">Slack ID:</p>
                            <p className="m-0 text-md font-bold">U093H5LJHGC</p>
                        </div>
                    </div>

                    <img src={profilepic} className={"w-24 md:w-52 mt-4 rounded-xl border-3 border-(--accent)"} alt={"Profile Picture"} />
                </div>

            </section>
        </AppShell>
    );
}