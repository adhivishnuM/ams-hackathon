import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { getTranslation } from "@/lib/translations";

interface OfflineBannerProps {
    language?: string;
}

export function OfflineBanner({ language = 'en' }: OfflineBannerProps) {
    const t = getTranslation('offline', language);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const checkStatus = () => {
            const forced = localStorage.getItem('agro_force_offline') === 'true';
            setIsOnline(navigator.onLine && !forced);
        };

        window.addEventListener("online", checkStatus);
        window.addEventListener("offline", checkStatus);
        window.addEventListener("offline-mode-change", checkStatus);

        // Initial check
        checkStatus();

        return () => {
            window.removeEventListener("online", checkStatus);
            window.removeEventListener("offline", checkStatus);
            window.removeEventListener("offline-mode-change", checkStatus);
        };
    }, []);

    if (isOnline) return null;

    return (
        <div className="bg-destructive text-destructive-foreground px-4 py-2 text-sm text-center font-medium animate-in slide-in-from-top flex items-center justify-center gap-2">
            <WifiOff size={14} />
            <span>{t.title}. {t.message}</span>
        </div>
    );
}
