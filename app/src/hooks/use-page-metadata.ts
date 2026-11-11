import { useEffect } from "react";

interface UsePageMetadataOptions {
    title?: string;
    iconUrl?: string;
}

export const usePageMetadata = ({ title, iconUrl }: UsePageMetadataOptions) => {
    useEffect(() => {
        if (title) {
            document.title = `${title} · Logiqdev OS`;
        }
        return () => {
            if (title) {
                document.title = "Logiqdev OS";
            }
        };
    }, [title]);

    useEffect(() => {
        if (iconUrl) {
            let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
            if (!link) {
                link = document.createElement("link");
                link.rel = "icon";
                document.getElementsByTagName("head")[0].appendChild(link);
            }
            link.href = iconUrl;
        }
    }, [iconUrl]);
};

