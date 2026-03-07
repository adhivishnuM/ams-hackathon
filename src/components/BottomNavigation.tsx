import { Home, Camera, BookOpen, Settings, User, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTranslation } from "@/lib/translations";

export type NavTab = "home" | "analyze" | "library" | "settings" | "assistant" | "market";

interface BottomNavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  language?: string;
}

export function BottomNavigation({ activeTab, onTabChange, language = 'en' }: BottomNavigationProps) {
  const t = getTranslation('nav', language);

  const tabs: { id: NavTab; icon: typeof Home; label: string }[] = [
    { id: "home", icon: Home, label: t.home },
    { id: "market", icon: ShoppingBag, label: t.market },
    { id: "analyze", icon: Camera, label: t.analyze },
    { id: "library", icon: BookOpen, label: t.library },
    { id: "settings", icon: Settings, label: t.settings },
  ];


  return (
    <nav className="fixed bottom-6 left-6 right-6 z-50 animate-in slide-in-from-bottom-10 duration-1000">
      <div
        className="glass-card rounded-[32px] flex justify-around items-center w-full max-w-lg mx-auto px-2 shadow-2xl border-white/10"
        style={{
          height: "88px",
        }}
      >
        {tabs.map(({ id, icon: Icon, label }) => {
          const isActive = activeTab === id;
          const isAnalyze = id === "analyze";

          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1.5 min-w-[70px] transition-all duration-300",
                "focus:outline-none focus:ring-0 rounded-3xl",
                "active:scale-[0.85] touch-none group",
                isActive ? "text-primary" : "text-muted-foreground/40 hover:text-foreground"
              )}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
            >
              {/* Icon container */}
              <div
                className={cn(
                  "flex items-center justify-center transition-all duration-500 p-3 rounded-2xl relative z-10",
                  isActive ? "bg-primary/10 scale-105" : "bg-transparent"
                )}
              >
                <Icon
                  size={id === "analyze" ? 28 : 22}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={cn(
                    "transition-all duration-500",
                    isActive ? "scale-100" : "scale-100"
                  )}
                />
              </div>

              <span className={cn(
                "text-[9px] font-black tracking-[0.15em] uppercase transition-all duration-500 relative z-10",
                isActive ? "opacity-100 translate-y-0 text-primary" : "opacity-0 translate-y-2"
              )}>
                {label}
              </span>

              {/* Dot indicator */}
              {isActive && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary animate-in zoom-in duration-500" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
