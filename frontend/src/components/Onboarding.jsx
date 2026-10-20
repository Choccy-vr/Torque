import {useState} from 'react'
import {ArrowLeft, ArrowRight, Check} from "lucide-react";

const steps = [
    {
        title: "Profile Information",
        description: "Pick a username, description, and profile picture that will show up to people who view your profile.",
    },
    {
        title: "Hackatime Setup",
        description: "Setup Hackatime to be able to ship your projects.",
    },
    {
        title: "Join our community on Slack",
        description: "Hack Club Community is amazing.",
    },
];

export default function Onboarding({ onComplete = () => {} }) {

    const [page, setPage] = useState(1);
    const [formData, setFormData] = useState({
        username: "",
        description: "",
        profilePicture: null,
    })

    const isFirstPage = page === 1;
    const isLastPage = page === 3;
    const currentStep = steps[page - 1];
    const progress = (page / steps.length) * 100;

    function updateField(e) {
        const { name, value } = e.target;

        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    }

    function nextPage(e) {
        e.preventDefault();

        if (page < steps.length) {
            setPage((prev) => prev + 1);
        }
    }

    function previousPage(e) {
        e.preventDefault();

        if (!isFirstPage) {
            setPage((prev) => prev - 1);
        }
    }

    function handleSubmit(e) {
        e.preventDefault();

        onComplete(formData);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-8">

            <div className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border-2 border-(--accent)/55 bg-(--bg) shadow-2xl transition-all duration-300 ease-in-out">
                <div className="h-1 w-full bg-(--accent)/15">
                    <div
                        className="h-full bg-(--accent) transition-all duration-500 ease"
                        style={{width: `${progress}%`}}
                    />
                </div>

                <div className="flex items-center justify-between gap-4 border-b border-(--accent)/20">
                    <form
                        key={page}
                        onSubmit={isLastPage ? handleSubmit : nextPage}
                        className="flex flex-col flex-1"
                    >
                        <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-12 sm:py-12">
                             <div className="mx-auto w-full max-w-lg">
                                 <div className="mb-6">
                                     <div className="flex flex-row gap-2 items-center mb-2 text-md font-medium ">
                                         <p className={page === 1 ? "text-(--accent)" : "" }>Username</p>
                                         <ArrowRight size={14} />
                                         <p className={page === 2 ? "text-(--accent)" : "" }>Hackatime</p>
                                         <ArrowRight size={14} />
                                         <p className={page === 3 ? "text-(--accent)" : "" }>Slack</p>
                                     </div>

                                     <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                                         {currentStep.title}
                                     </h2>

                                     <p className="mt-3 text-sm leading-6 opacity-60 sm:text-base">
                                         {currentStep.description}
                                     </p>
                                 </div>

                                 {page === 1 && (
                                     <div className="flex flex-col gap-2">
                                         <div className="">
                                             <label htmlFor="username" className="text-sm font-medium">Username</label>
                                             <input
                                                 type="text"
                                                 id="username"
                                                 name="username"
                                                 required
                                                 value={formData.username}
                                                 onChange={updateField}
                                                 minLength={4}
                                                 maxLength={24}
                                                 pattern="[A-Za-z0-9_]+"
                                                 autoComplete="username"
                                                 autoFocus
                                                 title="Use 4–24 letters, numbers, or underscores."
                                                 className="w-full h-12 rounded-xl bg-(--bg) px-4 outline-none border-2 focus:border-(--accent) transition-all placeholder:opacity-40 border-(--accent)/30"
                                                 placeholder="Orpheus_123"
                                             />
                                             <p className="text-xs opacity-50">
                                                 4-24 characters, letters, numbers, and underscores only.
                                             </p>
                                         </div>

                                         <div className="mt-4">
                                             <label htmlFor="description" className="text-sm font-medium">
                                                 Description
                                                 <span className="ml-2 opacity-40">
                                                    (Optional)
                                                 </span>
                                             </label>

                                             <textarea
                                                 id="description"
                                                 name="description"
                                                 maxLength={160}
                                                 onChange={updateField}
                                                 value={formData.description}
                                                 rows={4}
                                                 placeholder="Write a short description about yourself..."
                                                 className="w-full resize-none rounded-xl border-2 border-(--accent)/30 bg-(--bg) p-4 text-sm outline-none transition-all placeholder:opacity-40 focus:border-(--accent)"
                                             />
                                             <p className="text-right text-xs opacity-50">
                                                 {formData.description.length}/160
                                             </p>
                                         </div>
                                     </div>
                                 )}

                                 {page === 2 && (
                                     <div>
                                         <div className="rounded-xl border border-(--accent)/25 p-5">
                                             <label htmlFor="hackatime" className="text-sm text-center font-medium">
                                                 You will be redirected to the Hackatime Authorization Page
                                             </label>
                                             <button
                                                 onClick={() => {
                                                     window.location.href = "api/hackatime/start";
                                                 }}
                                                 type="button"
                                                 className="flex items-center w-full max-w-md justify-center gap-2 mt-2 rounded-xl bg-(--accent) px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
                                             >
                                                 Link Hackatime
                                             </button>
                                         </div>
                                     </div>
                                 )}

                                 {page === 3 && (
                                     <div>
                                        <div className="rounded-xl border border-(--accent)/25 p-5">
                                            <label htmlFor="hackatime" className="text-sm text-center font-medium">
                                                You will be redirected to the Hack Club Slack
                                            </label>
                                            <button
                                                onClick={() => {
                                                    window.location.href = "https://hackclub.com/slack/";
                                                }}
                                                type="button"
                                                className="flex items-center w-full max-w-md justify-center gap-2 mt-2 rounded-xl bg-(--accent) px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
                                            >
                                                Join The Slack
                                            </button>
                                         </div>
                                     </div>
                                 )}
                             </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 border-t border-(--accent)/20 p-5 sm:px-12 sm:py-6">
                            <button
                                type="button"
                                onClick={previousPage}
                                disabled={isFirstPage}
                                aria-label="Previous page"
                                className="flex items-center justify-center gap-2 rounded-xl border-3 border-(--accent)/30 px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-(--accent)/10 disabled:cursor-not-allowed disabled:opacity-30 hover:brightness-110 active:scale-[0.98]"
                            >

                                {/*flex size-10 shrink-0 items-center justify-center rounded-xl border border-(--accent)/30 transition-all hover:bg-(--accent)/10 disabled:cursor-not-allowed disabled:opacity-30*/}
                                <>
                                    <ArrowLeft size={18} />
                                    Back
                                </>
                            </button>

                            <button
                                type="submit"
                                className="flex items-center justify-center gap-2 rounded-xl bg-(--accent) px-5 py-3 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
                            >
                                {isLastPage ? (
                                    <>
                                        Finish
                                        <Check size={18} />
                                    </>
                                ) : (
                                    <>
                                        Continue
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}