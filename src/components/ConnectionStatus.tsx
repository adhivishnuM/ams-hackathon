import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectionStatusProps {
  isOnline: boolean;
}

export function ConnectionStatus({ isOnline }: ConnectionStatusProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-footnote font-semibold transition-all duration-200",
        isOnline
          ? "bg-green-wash text-primary"
          : "bg-muted text-muted-foreground"
      )}
      role="status"
      aria-live="polite"
    >
      {isOnline ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          <span>Online</span>
        </>
      ) : (
        <>
          <WifiOff size={14} />
          <span>Offline</span>
        </>
      )}
    </div>
  );
}
