const flag = "https://assets.hackclub.com/flag-standalone.png";

const columns = [
    {
        title: "Torque",
        links: [
            { name: "How It Works", href: "#how-it-works" },
            { name: "FAQ", href: "#faq" },
        ],
    },
    {
        title: "Hack Club",
        links: [
            { name: "hackclub.com", href: "https://hackclub.com" },
            { name: "Philosophy", href: "https://hackclub.com/philosophy/" },
            { name: "Team", href: "https://hackclub.com/team/" },
            { name: "Donate", href: "https://hackclub.com/philanthropy/" },
        ],
    },
    {
        title: "Community",
        links: [
            { name: "Slack", href: "https://hackclub.com/slack/" },
            { name: "GitHub", href: "https://github.com/hackclub" },
            { name: "Code of Conduct", href: "https://hackclub.com/conduct/" },
        ],
    },
];

const linkClass = "text-white transition-all duration-300 ease hover:opacity-75";

function FooterLink({ name, href }) {
    const external = href.startsWith("http");
    return (
        <a
            href={href}
            {...(external && { target: "_blank", rel: "noopener noreferrer" })}
            className={linkClass}
        >
            {name}
        </a>
    );
}

export default function Footer() {
    return (
        <footer className="font-phantom relative z-20 w-full px-6 md:px-20 pb-10 mt-20">
            <div className="max-w-screen-2xl mx-auto bg-[#25282A] text-[#FFB703] rounded-xl p-8 md:p-12">
                <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
                    <div className="flex flex-col gap-4 max-w-md">
                        <a
                            href="https://hackclub.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-fit transition-all duration-300 ease hover:opacity-75"
                        >
                            <img src={flag} alt="Hack Club Flag" className="h-16" />
                        </a>
                        <h2 className="text-5xl md:text-6xl font-bold">TORQUE</h2>
                        <p className="text-lg text-white">
                            Made with &lt;3 by the{" "}
                            <a
                                href="https://hackclub.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#FFB703] transition-all duration-300 ease hover:opacity-75"
                            >
                                Hack Club
                            </a>{" "}
                            community
                        </p>
                        <p className="text-white">
                            Sponsored by @Meghana
                        </p>
                    </div>

                    {columns.map((col) => (
                        <div key={col.title} className="flex flex-col gap-4">
                            <h3 className="text-2xl font-bold">{col.title}</h3>
                            <ul className="flex flex-col gap-3 text-lg">
                                {col.links.map((link) => (
                                    <li key={link.name}>
                                        <FooterLink {...link} />
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <p className="mt-10 pt-6 border-t border-[#FFB703]/20 text-sm text-white/50">
                    © {new Date().getFullYear()} Hack Club. Registered under The Hack Foundation, a 501(c)(3) nonprofit (EIN: 81-2908499).
                </p>
            </div>
        </footer>
    );
}
