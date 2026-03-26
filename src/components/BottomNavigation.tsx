import { Home, Camera, BookOpen, Settings, ShoppingBag } from "lucide-react";
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
    { id: "home",     icon: Home,        label: t.home },
    { id: "market",   icon: ShoppingBag, label: t.market },
    { id: "analyze",  icon: Camera,      label: t.analyze },
    { id: "library",  icon: BookOpen,    label: t.library },
    { id: "settings", icon: Settings,    label: t.settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-safe">
      {/* Glass pill */}
      <div className="max-w-lg mx-auto mb-4">
        <div
          className="relative flex items-center justify-around rounded-[28px] px-1 py-2"
          style={{
            background: 'rgba(255,255,255,0.82)',
            backdropFilter: 'blur(32px) saturate(180%)',
            WebkitBackdropFilter: 'blur(32px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.7)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,0.9) inset',
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
                  "relative flex flex-col items-center justify-center gap-1 transition-all duration-300",
                  "focus:outline-none active:scale-90 touch-none",
                  isAnalyze ? "w-14 h-14" : "flex-1 py-2"
                )}
                aria-label={label}
              >
                {isAnalyze ? (
                  /* Camera — raised centre button */
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300",
                    isActive
                      ? "bg-primary shadow-green scale-105"
                      : "bg-primary/90 hover:bg-primary"
                  )}>
                    <Icon size={26} strokeWidth={2} className="text-white" />
                  </div>
                ) : (
                  <>
                    {/* Icon with active background pill */}
                    <div className={cn(
                      "flex items-center justify-center w-10 h-8 rounded-xl transition-all duration-300",
                      isActive ? "bg-primary/12" : ""
                    )}>
                      <Icon
                        size={20}
                        strokeWidth={isActive ? 2.5 : 1.8}
                        className={cn(
                          "transition-all duration-300",
                          isActive ? "text-primary" : "text-muted-foreground/60"
                        )}
                      />
                    </div>
                    <span className={cn(
                      "text-[9.5px] font-semibold tracking-wide uppercase transition-all duration-300",
                      isActive ? "text-primary opacity-100" : "text-muted-foreground/50 opacity-80"
                    )}>
                      {label}
                    </span>
                    {/* Active dot */}
                    {isActive && (
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
