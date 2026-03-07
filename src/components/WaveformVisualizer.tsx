import { cn } from "@/lib/utils";

interface WaveformVisualizerProps {
  isActive: boolean;
  barCount?: number;
}

export function WaveformVisualizer({ isActive, barCount = 40 }: WaveformVisualizerProps) {
  return (
    <div className="flex items-center justify-center gap-0.5 h-32">
      {Array.from({ length: barCount }).map((_, i) => {
        // Create more natural wave pattern
        const baseDelay = Math.sin(i / 4) * 0.15;
        return (
          <div
            key={i}
            className={cn(
              "w-1 rounded-full transition-all",
              isActive 
                ? "bg-primary/80 animate-waveform" 
                : "bg-muted h-2"
            )}
            style={{
              animationDelay: isActive ? `${baseDelay}s` : undefined,
              height: isActive ? undefined : "8px",
              animationDuration: isActive ? `${0.4 + Math.random() * 0.3}s` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
