import { Play, Pause, Clock, ChevronRight } from "lucide-react";
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

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "group glass-card rounded-[24px] p-5",
        "shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer overflow-hidden relative",
        isPlaying && "ring-2 ring-primary/40 bg-primary/5"
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-start gap-3">
        {/* Crop Icon */}
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-wash flex items-center justify-center text-2xl">
          {cropEmojis[cropType]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground line-clamp-1 text-body">{query}</p>
          <p className="text-muted-foreground text-subhead line-clamp-2 mt-1">
            {response}
          </p>
          <div className="flex items-center gap-1 mt-2 text-caption text-muted-foreground">
            <Clock size={12} />
            <span>{formatTime(timestamp)}</span>
          </div>
        </div>

        {/* Play Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlay(id);
          }}
          className={cn(
            "flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-primary/30",
            "active:scale-95",
            isPlaying
              ? "bg-primary text-primary-foreground shadow-green"
              : "bg-green-subtle text-primary hover:bg-primary hover:text-primary-foreground"
          )}
          aria-label={isPlaying ? "Pause" : "Play response"}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>
      </div>
    </div>
  );
}
