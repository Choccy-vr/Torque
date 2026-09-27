import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { RootProvider } from "fumadocs-ui/provider/react-router";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Callout } from "fumadocs-ui/components/callout";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { File, Files, Folder } from "fumadocs-ui/components/files";
import { ImageZoom } from "fumadocs-ui/components/image-zoom";
import { source } from "../lib/source.js";

// Components available inside every .mdx file without importing them.
const mdxComponents = {
    ...defaultMdxComponents,
    Callout,
    Tab,
    Tabs,
    Step,
    Steps,
    Accordion,
    Accordions,
    File,
    Files,
    Folder,
    // Click any image in the docs to zoom it.
    img: (props) => <ImageZoom {...props} />,
};

export default function Docs() {
    const { "*": splat = "" } = useParams();
    const slugs = splat.split("/").filter(Boolean);
    const page = source.getPage(slugs);

    return (
        // Fumadocs' own light/dark switching is off: colors come from Torque's
        // theme tokens instead (see the .torque-docs block in index.css).
        <div className="torque-docs dark">
            <RootProvider theme={{ enabled: false }} search={{ enabled: false }}>
                <DocsLayout
                    tree={source.pageTree}
                    nav={{ title: <span className="t-heading text-lg">Torque Docs</span>, url: "/docs" }}
                    themeSwitch={{ enabled: false }}
                    searchToggle={{ enabled: false }}
                    sidebar={{
                        banner: (
                            <Link
                                to="/home"
                                className="t-btn t-hover flex items-center justify-center gap-2 rounded-(--radius) px-4 py-2 font-bold"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back to Home
                            </Link>
                        ),
                    }}
                >
                    {page ? <DocContent page={page} /> : <NotFound />}
                </DocsLayout>
            </RootProvider>
        </div>
    );
}

function DocContent({ page }) {
    const MDX = page.data.body;

    return (
        <DocsPage toc={page.data.toc}>
            <title>{`Torque - ${page.data.title}`}</title>
            <DocsTitle>{page.data.title}</DocsTitle>
            {page.data.description && <DocsDescription>{page.data.description}</DocsDescription>}
            <DocsBody>
                <MDX components={mdxComponents} />
            </DocsBody>
        </DocsPage>
    );
}

function NotFound() {
    return (
        <DocsPage>
            <DocsTitle>Doc not found</DocsTitle>
            <DocsBody>
                <p>
                    That page doesn&apos;t exist. <Link to="/docs">Back to the docs</Link>.
                </p>
            </DocsBody>
        </DocsPage>
    );
}
