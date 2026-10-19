import {useState} from 'react'
import {ArrowLeft, ArrowRight, Check} from "lucide-react";

const steps = [
    {
        title: "Choose a username",
        description: "Pick a username which will show up to people on your profile.",
    },
    {
        title: "Tell us about yourself",
        description: "Create a description about yourself to let people know more about you.",
    },
    {
        title: "Change your profile picture",
        description: "Choose a new profile picture, or keep the one you have on Slack.",
    },
    {
        title: "Your all set",
        description: "Review your details and finish setting up your account.",
    },
];

export default function Onboarding() {

    const [page, setPage] = useState(1);

    const isFirstPage = page === 1;
    const isLastPage = page === 4;
    const currentStep = steps[page - 1];
    const progress = (page / steps.length) * 100;

    function nextPage(e) {
        e.preventDefault();

        if (page < steps.length) {
            setPage((prev) => prev + 1);
        }
    }

    function previousPage(e) {
        if (page > 1) {
            setPage((prev) => prev - 1);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 sm:p-8">

            <div className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border-2 border-(--accent)/55 bg-(--bg) shadow-2xl transition-all duration-300 ease-in-out">
                <div className="h-1 w-full bg-(--accent)/15">
                    <div
                        className="h-full bg-(--accent) transition-all duration-500 ease"
                        style={{width: `${progress}%`}}
                    />
                </div>

                <div className="flex items-center justify-between gap-4 border-b border-(--accent)/20 p-5 sm:p-7">
                    <div className="flex min-w-0 items-center gap-3">
                        <button
                            type="button"
                            onClick={previousPage}
                            disabled={isFirstPage}
                            aria-label="Previous page"
                            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-(--accent)/30 transition-all hover:bg-(accent)/10 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                            <ArrowLeft size={20} />
                        </button>

                        <div>
                            <h1 className="text-lg font-semibold sm:text-xl">
                                Onboarding
                            </h1>

                            <p className="text-sm opacity-60">
                                Step {page} of {steps.length}
                            </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                            {steps.map((step, index) => {
                                const stepNumber = index + 1;
                                const isCompleted = stepNumber < page;
                                const isActive = stepNumber === page;
                                return (
                                    <div
                                        key={step.title}
                                        aria-label={`Step ${stepNumber}${isCompleted ? ", completed" : isActive ? ", current" : ""}`}
                                        className={` flex size-8 items-center justify-center rounded-full border text-xs font-semibold transition-all duration-300 
                                        ${ isCompleted || isActive ? "border-(--accent) bg-(--accent) text-white" : "border-(--accent)/30 opacity-50" } `}
                                    >
                                        {isCompleted ? ( <Check size={16} /> ) : ( stepNumber )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>


                    <form
                        key={page}
                        onSubmit={isLastPage ? previousPage : nextPage}
                        className="flex flex-col flex-1"
                    >
                        <div className="flex flex-1 flex-col justify-center px-6 py-10 sm:px-12 sm:py-14">
                             <div className="mx-auto w-full max-w-lg">
                                 <div className="mb-8">
                                     <p className="mb-2 text-sm font-medium text-(--accent)">
                                         STEP {page}
                                     </p>

                                     <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                                         {currentStep.title}
                                     </h2>

                                     <p className="mt-3 text-sm leading-6 opacity-60 sm:text-base">
                                         {currentStep.description}
                                     </p>
                                 </div>

                                 {page === 1 && (
                                     <div className="flex flex-col gap-2">
                                        <label htmlFor="username" className="text-sm font-medium">username</label>
                                         <input
                                             type="user"
                                             id="username"
                                             name="username"
                                             required
                                             minLength={4}
                                             maxLength={24}
                                             pattern="[A-Za-z0-9_]+"
                                             autoComplete="username"
                                             autoFocus
                                             title="Use 3–24 letters, numbers, or underscores."
                                             className="w-full h-12 rounded-xl bg-(--bg) px-4 outline-none border-2 focus:border-(--accent) transition-all placeholder:opacity-40 border-(--accent)/30"
                                             placeholder="Username123"
                                         />
                                         <p className="text-xs opacity-50">
                                             4-24 characters, letters, numbers, and underscores only.
                                         </p>
                                     </div>
                                 )}

                                 {page === 2 && (
                                     <div className="flex flex-col gap-2">
                                         <label htmlFor="bio" className="text-sm font-medium">
                                             bio
                                            About you
                                             <span className="ml-2 opacity-40">
                                                 (Optional)
                                             </span>
                                         </label>

                                         <textarea
                                             id="bio"
                                             name="bio"
                                             maxLength={160}
                                             rows={4}
                                             placeholder="Write a short description about yourself..."
                                             className="w-full resize-none rounded-xl border-2 border-(--accent)/30 bg-(--bg) p-4 text-sm outline-none transition-all placeholder:opacity-40 focus:border-(--accent)"
                                         />

                                         <p className="text-right text-xs opacity-50">
                                             REPLACEME/160
                                         </p>
                                     </div>
                                 )}

                                 {page === 3 && (
                                     <div className="flex flex-col gap-2">
                                         <label htmlFor="profile picture" className="text-sm font-medium">
                                             profile picture
                                             <span className="ml-2 opacity-40">
                                                 (Optional)
                                             </span>
                                         </label>
                                     </div>
                                 )}

                                 {page === 4 && (
                                     <div className="space-y-4">
                                        <div className="rounded-xl border border-(--accent)/25 p-5">
                                            <p className="mb-1 text-xs font-medium uppercase tracking-wider opacity-50">
                                                Username
                                            </p>

                                            <p className="break-words text-lg font-semibold">
                                                REPLACEME
                                            </p>
                                        </div>

                                         <div className="rounded-xl border border-(--accent)/25 p-5">
                                             <p className="mb-1 text-xs font-medium uppercase tracking-wider opacity-50">
                                                 About you
                                             </p>

                                             <p className="break-words text-lg font-semibold">
                                                 REPLACEME
                                             </p>
                                         </div>

                                         <p className="text-sm opacity-60">
                                             Everything look good? Finish to complete your onboarding.
                                         </p>

                                     </div>
                                 )}
                             </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 border-t border-(--accent)/20 p-5 sm:px-12 sm:py-6">
                            <p className="text-sm opacity-50">
                                {isLastPage ? "Ready to get started?" : `${steps.length - page} step${steps.length - page === 1 ? "" : "s"} remaining`}
                            </p>

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