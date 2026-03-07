import { Mic, Loader2, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface MicrophoneButtonProps {
  isRecording: boolean;
  isProcessing: boolean;
  onClick: () => void;
  size?: "small" | "default" | "large";
}

export function MicrophoneButton({
  isRecording,
  isProcessing,
  onClick,
  size = "large",
}: MicrophoneButtonProps) {
  const sizeClasses = {
    small: "w-10 h-10",
    default: "w-16 h-16",
    large: "w-20 h-20"
  }[size];

  const iconSize = {
    small: 18,
    default: 24,
    large: 32
  }[size];

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer pulse ring - idle state (only for default/large) */}
      {!isRecording && !isProcessing && size !== "small" && (
        <>
          <div
            className={cn(
              "absolute rounded-full bg-primary/20 animate-pulse-glow",
              size === "large" ? "w-24 h-24" : "w-20 h-20"
            )}
          />
          <div
            className={cn(
              "absolute rounded-full bg-primary/10 animate-pulse-glow",
              size === "large" ? "w-32 h-32" : "w-28 h-28"
            )}
            style={{ animationDelay: "0.5s" }}
          />
        </>
      )}

      {/* Recording pulse ring - red */}
      {isRecording && (
        <div
          className={cn(
            "absolute rounded-full border-4 border-destructive animate-ripple",
            size === "large" ? "w-24 h-24" : (size === "default" ? "w-20 h-20" : "w-12 h-12")
          )}
        />
      )}

      {/* Main button */}
      <button
        onClick={onClick}
        disabled={isProcessing}
        className={cn(
          "relative z-10 flex items-center justify-center rounded-full transition-all duration-200",
          "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground",
          "shadow-green hover:shadow-green-lg",
          "hover:scale-105 active:scale-95",
          "focus:outline-none focus:ring-4 focus:ring-primary/30",
          "disabled:opacity-70 disabled:cursor-not-allowed",
          sizeClasses,
          isRecording && "bg-gradient-to-br from-destructive to-destructive/90 shadow-none"
        )}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
      >
        {isProcessing ? (
          <Loader2 size={iconSize} className="animate-spin-smooth" />
        ) : isRecording ? (
          <Square size={iconSize} className="fill-current animate-pulse" />
        ) : (
          <Mic size={iconSize} />
        )}
      </button>
    </div>
  );
}
