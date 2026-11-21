import { lazy, Suspense } from "react";
import { Theme, type EmojiClickData } from "emoji-picker-react";
import { useTheme } from "@/hooks/use-theme";
import { Spinner } from "@/components/ui/spinner";

// The picker (and its emoji data) is large: load it only when a popover actually opens.
const Picker = lazy(() => import("emoji-picker-react"));

interface EmojiPickerProps {
    /** Called with the chosen emoji character (e.g. "👍"). */
    onSelect: (emoji: string) => void;
    className?: string;
}

/** Full Unicode emoji picker (search, categories, skin tones, recents), themed with the app's light/dark mode. */
export function EmojiPicker({ onSelect, className }: EmojiPickerProps) {
    const { resolved } = useTheme();
    return (
        <Suspense fallback={<div className="grid h-[380px] w-[320px] place-items-center"><Spinner /></div>}>
            <Picker
                className={className}
                theme={resolved === "dark" ? Theme.DARK : Theme.LIGHT}
                width={320}
                height={380}
                lazyLoadEmojis
                previewConfig={{ showPreview: false }}
                onEmojiClick={(e: EmojiClickData) => onSelect(e.emoji)}
            />
        </Suspense>
    );
}
