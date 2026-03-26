import { Play, Pause, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface RecentQueryCardProps {
  id: string;
  query: string;
  response: string;
  timestamp: Date;
  cropType?: "wheat" | "rice" | "potato" | "tomato" | "apple" | "leaf" | "general";
  onPlay: (id: string) => void;
  isPlaying?: boolean;
  onClick?: () => void;
}

const cropEmojis = {
  wheat: "🌾",
  rice: "🌿",
  potato: "🥔",
  tomato: "🍅",
  apple: "🍎",
  leaf: "🍃",
  general: "🌱",
};

export function RecentQueryCard({
  id,
  query,
  response,
  timestamp,
  cropType = "general",
  onPlay,
  isPlaying = false,
  onClick,
}: RecentQueryCardProps) {
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl border bg-card overflow-hidden cursor-pointer transition-all duration-200",
        "hover:border-primary/30 hover:shadow-sm active:scale-[0.99]",
        isPlaying && "ring-1 ring-primary/30 border-primary/20"
      )}
    >
      {/* Mini chat panel */}
      <div className="p-3 space-y-2">
        {/* User message */}
        <div className="flex items-start gap-2 justify-end">
          <div className="bg-primary text-white text-[12px] font-medium px-3 py-1.5 rounded-2xl rounded-br-sm max-w-[85%] line-clamp-1">
            {query}
          </div>
        </div>

        {/* AI response */}
        <div className="flex items-start gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[11px] shrink-0">
            {cropEmojis[cropType]}
          </div>
          <div className="bg-muted/50 text-muted-foreground text-[11px] px-3 py-1.5 rounded-2xl rounded-tl-sm flex-1 line-clamp-2 leading-relaxed">
            {response?.replace(/\*\*/g, '').replace(/\*/g, '') || '—'}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border/30 bg-muted/20">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
          <Clock size={10} />
          <span>{formatTime(timestamp)}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay(id);
          }}
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90",
            isPlaying
              ? "bg-primary text-white shadow-sm"
              : "bg-primary/10 text-primary hover:bg-primary hover:text-white"
          )}
          aria-label={isPlaying ? "Pause" : "Play response"}
        >
          {isPlaying ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
        </button>
      </div>
    </div>
  );
}
