import { useState, useEffect } from "react";
import {
  Volume2, Globe, Moon, Sun, Trash2, Bell, ChevronRight,
  MapPin, Zap, HardDrive, RefreshCw, WifiOff, DownloadCloud
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useChat } from "@/hooks/useChat";
import { syncService } from "@/services/syncService";
import { toast } from "sonner";

interface SettingsScreenProps {
  language: string;
  onLanguageChange: (code: string) => void;
  voiceSpeed: "slow" | "normal" | "fast";
  onVoiceSpeedChange: (speed: "slow" | "normal" | "fast") => void;
}

const languages = [
  { code: "en", name: "English", nativeName: "English", flag: "🇬🇧" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", flag: "🇮🇳" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", flag: "🇮🇳" },
  { code: "mr", name: "Marathi", nativeName: "मराठी", flag: "🇮🇳" },
];

const translations = {
  en: {
    settings: "Settings",
    common: "Common",
    appearance: "Appearance",
    storage: "Storage & Data",
    language: "Language",
    voiceSpeed: "Voice Speed",
    darkMode: "Dark Mode",
    notifications: "Notifications",
    location: "My Location",
    locationDesc: "Used for weather alerts",
    dataSaver: "Data Saver Mode",
    dataSaverDesc: "Reduce image quality to save data",
    clearHistory: "Clear Chat History",
    clearCache: "Clear App Cache",
    clearConfirm: "Are you sure? This action cannot be undone.",
    version: "Version",
    slow: "Slow",
    normal: "Normal",
    fast: "Fast",
    cleared: "Cleared successfully",
    cacheSize: "14.2 MB used",
    detecting: "Detecting..."
  },
  hi: {
    settings: "सेटिंग्स",
    common: "सामान्य",
    appearance: "दिखावट",
    storage: "स्टोरेज और डेटा",
    language: "भाषा",
    voiceSpeed: "आवाज की गति",
    darkMode: "डार्क मोड",
    notifications: "सूचनाएं",
    location: "मेरा स्थान",
    locationDesc: "मौसम अलर्ट के लिए उपयोग किया जाता है",
    dataSaver: "डेटा सेवर मोड",
    dataSaverDesc: "डेटा बचाने के लिए इमेज क्वालिटी कम करें",
    clearHistory: "चैट इतिहास साफ़ करें",
    clearCache: "ऐप कैश साफ़ करें",
    clearConfirm: "क्या आप सुनिश्चित हैं?",
    version: "संस्करण",
    slow: "धीमी",
    normal: "सामान्य",
    fast: "तेज़",
    cleared: "सफलतापूर्वक साफ़ किया गया",
    cacheSize: "14.2 MB",
    detecting: "खोज रहा है..."
  },
  ta: { settings: "அமைப்புகள்", common: "பொது", appearance: "தோற்றம்", storage: "சேமிப்பு", language: "மொழி", voiceSpeed: "குரல் வேகம்", darkMode: "டார்க் பயன்முறை", notifications: "அறிவிப்புகள்", location: "இருப்பிடம்", locationDesc: "வானிலைக்காக", dataSaver: "தரவு சேமிப்பு", dataSaverDesc: "தரவைச் சேமிக்கவும்", clearHistory: "வரலாற்றை அழி", clearCache: "கேச் அழி", clearConfirm: "நிச்சயமாகவா?", version: "பதிப்பு", slow: "மெதுவான", normal: "சாதாரண", fast: "வேகமான", cleared: "அழிக்கப்பட்டது", cacheSize: "14.2 MB", detecting: "கண்டறிதல்..." },
  te: { settings: "సెట్టింగ్‌లు", common: "సాధారణ", appearance: "కனிபించు", storage: "నిల్వ", language: "భాష", voiceSpeed: "వాయిస్ వేగం", darkMode: "డార్క్ మోడ్", notifications: "నోటిnotificationలు", location: "స్థానం", locationDesc: "వాతావরণం కోసం", dataSaver: "డేటా సేవర్", dataSaverDesc: "డేటాను సేవ్ చేయండి", clearHistory: "చరిత్రను క్లిயர் చేయండి", clearCache: "కాష్ క్లియర్ చేయండి", clearConfirm: "ఖచ్చితంగా ఉన్నారా?", version: "వెర్షన్", slow: "నెమ్మదిగా", normal: "సాధారణ", fast: "వేగంగా", cleared: "క్లిயர் చేయబడింది", cacheSize: "14.2 MB", detecting: "గుర్తిస్తోంది..." },
  mr: { settings: "सेटिंग्ज", common: "सामान्य", appearance: "दिसणे", storage: "स्टोरेज", language: "भाषा", voiceSpeed: "आवाज वेग", darkMode: "डार्क मोड", notifications: "सूचना", location: "स्थान", locationDesc: "हवामानासाठी", dataSaver: "डेटा सेव्हर", dataSaverDesc: "डेटा वाचवा", clearHistory: "इतिहास साफ करा", clearCache: "कॅशे साफ करा", clearConfirm: "खात्री आहे का?", version: "आवृत्ती", slow: "हळू", normal: "सामान्य", fast: "वेगवान", cleared: "साफ केले", cacheSize: "14.2 MB", detecting: "शोधत आहे..." },
};

// Perfect Pill Structure Toggle Switch
function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      className={cn(
        "relative w-[52px] h-[30px] flex items-center rounded-full p-1 cursor-pointer transition-all duration-400 ease-in-out shadow-inner",
        enabled ? "bg-[#76b900] shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]" : "bg-zinc-200 dark:bg-zinc-800"
      )}
    >
      <div
        className={cn(
          "w-[22px] h-[22px] bg-white rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all duration-400 cubic-bezier(0.34, 1.56, 0.64, 1)",
          enabled ? "translate-x-[22px]" : "translate-x-0"
        )}
      />
    </div>
  );
}

// Reusable Setting Row
function SettingRow({
  icon: Icon,
  title,
  subtitle,
  value,
  onClick,
  action
}: {
  icon?: any;
  title: string;
  subtitle?: string;
  value?: string;
  onClick?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center justify-between p-5 min-h-[72px] transition-all duration-200 active:scale-[0.98]",
        onClick ? "cursor-pointer hover:bg-white/5 active:bg-white/10" : ""
      )}
    >
      <div className="flex items-center gap-4 overflow-hidden">
        {Icon && (
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/5 shadow-sm">
            <Icon size={22} className="text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-bold text-foreground tracking-tight leading-tight">{title}</p>
          {subtitle && (
            <p className="text-sm font-medium text-muted-foreground/70 truncate mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 pl-2">
        {value && (
          <span className="text-[15px] font-bold text-muted-foreground/60">{value}</span>
        )}
        {action}
        {onClick && !action && (
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted/30 group-hover:bg-muted/50 transition-colors">
            <ChevronRight size={18} className="text-muted-foreground/40" />
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsScreen({
  language,
  onLanguageChange,
  voiceSpeed,
  onVoiceSpeedChange,
}: SettingsScreenProps) {
  const t = (translations[language as keyof typeof translations] || translations.en) as any;
  const { clearHistory } = useChat();

  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark" ||
      document.documentElement.classList.contains("dark");
  });

  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem("notifications") !== "false";
  });

  const [dataSaver, setDataSaver] = useState(() => {
    return localStorage.getItem("dataSaver") === "true";
  });

  const [forceOffline, setForceOffline] = useState(() => {
    return localStorage.getItem("agro_force_offline") === "true";
  });

  const [autoSave, setAutoSave] = useState(() => {
    // Default to true if not set, or check user pref
    return localStorage.getItem("agro_auto_save") !== "false";
  });

  const [locationName, setLocationName] = useState("Delhi, India");

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  useEffect(() => {
    // Attempt to get nicer location name from cache if available?
    // For now we just mock or use geolocation
    navigator.geolocation?.getCurrentPosition((pos) => {
      // In a real app we'd reverse geocode here
      setLocationName(`${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`);
    });
  }, []);

  const [storageUsage, setStorageUsage] = useState<string>("");

  useEffect(() => {
    const fetchStorageObj = async () => {
      if (navigator.storage && navigator.storage.estimate) {
        try {
          const estimate = await navigator.storage.estimate();
          if (estimate.usage) {
            const mb = (estimate.usage / (1024 * 1024)).toFixed(1);
            setStorageUsage(`${mb} MB used`);
          }
        } catch (e) {
          console.error("Storage estimate failed", e);
        }
      }
    };
    fetchStorageObj();
  }, []);

  const handleToggleInternal = (
    val: boolean,
    setVal: (v: boolean) => void,
    key: string,
    message?: string
  ) => {
    const newVal = !val;
    setVal(newVal);
    localStorage.setItem(key, String(newVal));
    if (newVal && message) toast.success(message);
  };

  const handleClearHistory = async () => {
    if (window.confirm(t.clearConfirm)) {
      await clearHistory();
      toast.success(t.cleared);
    }
  };

  const handleClearCache = () => {
    if (window.confirm(t.clearConfirm)) {
      localStorage.removeItem("weather_cache");
      localStorage.removeItem("last_analysis");
      toast.success(t.cleared);
    }
  };

  const selectedLangName = languages.find(l => l.code === language)?.nativeName;

  return (
    <div className="flex flex-col flex-1 bg-background pb-32 animate-fade-in min-h-screen">
      {/* Header with improved styling */}
      <div className="px-6 pt-12 pb-8 sticky top-0 z-30 bg-background/60 backdrop-blur-2xl border-b border-white/10 shadow-sm">
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">{t.settings}</h1>
        <p className="text-sm text-muted-foreground mt-1 font-medium opacity-80">Personalize your AgroTalk experience</p>
      </div>

      <div className="px-5 py-8 space-y-10 max-w-lg mx-auto w-full">

        {/* COMMON SETTINGS */}
        <section className="animate-in slide-in-from-bottom-4 duration-500 delay-100 fill-mode-both">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground/60">
              {t.common}
            </h2>
          </div>
          <div className="glass-card rounded-[24px] overflow-hidden border border-white/10 shadow-2xl shadow-black/5">

            {/* Language Selector */}
            <div className="relative group">
              <SettingRow
                icon={Globe}
                title={t.language}
                value={selectedLangName}
              />
              <select
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                value={language}
                onChange={(e) => onLanguageChange(e.target.value)}
              >
                {languages.map(l => (
                  <option key={l.code} value={l.code}>{l.flag} {l.nativeName}</option>
                ))}
              </select>
            </div>

            <div className="w-full h-px bg-white/5 mx-4" />

            {/* Location */}
            <SettingRow
              icon={MapPin}
              title={t.location}
              subtitle={locationName}
              action={<RefreshCw size={16} className="text-primary animate-spin-slow opacity-60" />}
              onClick={() => {
                setLocationName(t.detecting);
                setTimeout(() => {
                  navigator.geolocation?.getCurrentPosition(
                    (p) => {
                      setLocationName(`${p.coords.latitude.toFixed(1)}, ${p.coords.longitude.toFixed(1)}`);
                      toast.success("Location updated");
                    },
                    (e) => {
                      console.error(e);
                      setLocationName("Permission denied");
                      toast.error("Could not detect location");
                    }
                  );
                }, 1000);
              }}
            />

            <div className="w-full h-px bg-white/5 mx-4" />

            {/* Voice Speed */}
            <div className="p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Volume2 size={20} className="text-primary" />
                </div>
                <span className="text-[17px] font-semibold text-foreground">{t.voiceSpeed}</span>
              </div>
              <div className="flex bg-muted/50 backdrop-blur-md rounded-2xl p-1.5 border border-white/5">
                {(["slow", "normal", "fast"] as const).map((speed) => (
                  <button
                    key={speed}
                    onClick={() => onVoiceSpeedChange(speed)}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-sm font-bold transition-all duration-300",
                      voiceSpeed === speed
                        ? "bg-white dark:bg-zinc-100 text-primary shadow-xl scale-100"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5 scale-95"
                    )}
                  >
                    {t[speed]}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* APPEARANCE */}
        <section className="animate-in slide-in-from-bottom-4 duration-500 delay-200 fill-mode-both">
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground/60 mb-4 px-2">
            {t.appearance}
          </h2>
          <div className="glass-card rounded-[24px] overflow-hidden border border-white/10 shadow-2xl shadow-black/5">

            <SettingRow
              icon={isDarkMode ? Moon : Sun}
              title={t.darkMode}
              action={
                <ToggleSwitch enabled={isDarkMode} onToggle={() => setIsDarkMode(!isDarkMode)} />
              }
            />

            <div className="w-full h-px bg-white/5 mx-4" />

            <SettingRow
              icon={Bell}
              title={t.notifications}
              action={
                <ToggleSwitch
                  enabled={notificationsEnabled}
                  onToggle={() => handleToggleInternal(notificationsEnabled, setNotificationsEnabled, "notifications", "Notification settings saved")}
                />
              }
            />
          </div>
        </section>

        {/* STORAGE & DATA */}
        <section className="animate-in slide-in-from-bottom-4 duration-500 delay-300 fill-mode-both">
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground/60 mb-4 px-2">
            {t.storage || "Storage & Data"}
          </h2>
          <div className="glass-card rounded-[24px] overflow-hidden border border-white/10 shadow-2xl shadow-black/5">

            {/* Force Offline Mode */}
            <SettingRow
              icon={WifiOff}
              title={t.forceOffline || "Deep Offline Mode"}
              subtitle={t.forceOfflineDesc || "Simulate fully offline experience"}
              action={
                <ToggleSwitch
                  enabled={forceOffline}
                  onToggle={() => {
                    const newVal = !forceOffline;
                    setForceOffline(newVal);
                    localStorage.setItem('agro_force_offline', String(newVal));
                    toast.success(newVal ? "Offline mode active" : "Online mode restored");
                    window.dispatchEvent(new Event('offline-mode-change'));
                  }}
                />
              }
            />

            <div className="w-full h-px bg-white/5 mx-4" />

            {/* Auto Save Data */}
            <SettingRow
              icon={DownloadCloud}
              title={t.autoSave || "Smart Auto-Save"}
              subtitle={t.autoSaveDesc || "Continuous data backup"}
              action={
                <ToggleSwitch
                  enabled={autoSave}
                  onToggle={() => handleToggleInternal(autoSave, setAutoSave, "agro_auto_save", "Auto-Save settings updated")}
                />
              }
            />

            <div className="w-full h-px bg-white/5 mx-4" />

            {/* Manual Sync */}
            <SettingRow
              icon={RefreshCw}
              title={t.syncNow || "Manual Cloud Sync"}
              subtitle={t.syncDesc || "Push local updates to server"}
              onClick={async () => {
                toast.info("Starting sync...");
                await syncService.syncAll();
                toast.success("Sync complete");
              }}
            />

            <div className="w-full h-px bg-white/5 mx-4" />

            <SettingRow
              icon={Zap}
              title={t.dataSaver}
              subtitle={t.dataSaverDesc}
              action={
                <ToggleSwitch
                  enabled={dataSaver}
                  onToggle={() => handleToggleInternal(dataSaver, setDataSaver, "dataSaver", "Data Saver updated")}
                />
              }
            />

            <div className="w-full h-px bg-white/5 mx-4" />

            <SettingRow
              icon={HardDrive}
              title={t.clearCache}
              subtitle={storageUsage || t.cacheSize}
              onClick={handleClearCache}
            />

            <div className="w-full h-px bg-white/5 mx-4" />

            <div
              onClick={handleClearHistory}
              className="flex items-center justify-between p-5 cursor-pointer active:bg-destructive/10 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-destructive/10 flex items-center justify-center group-hover:bg-destructive/20 group-active:scale-90 transition-all">
                  <Trash2 size={22} className="text-destructive" />
                </div>
                <div className="flex-col">
                  <p className="text-[17px] font-bold text-destructive">{t.clearHistory}</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-destructive/30" />
            </div>

          </div>
        </section>

        {/* Footer info */}
        <div className="flex flex-col items-center justify-center py-12 gap-5 opacity-40 hover:opacity-100 transition-opacity">
          <div className="w-16 h-16 rounded-[20px] glass-card shadow-2xl border border-white/20 flex items-center justify-center p-3">
            <img src="/logo.svg" className="w-full h-full object-contain filter grayscale" alt="Logo" />
          </div>
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-widest text-foreground/80">Agrotalk Assist</p>
            <p className="text-[10px] font-bold text-muted-foreground mt-1 tabular-nums">BUILD 2.1.0-BETA</p>
          </div>
        </div>

      </div>
    </div>
  );
}
