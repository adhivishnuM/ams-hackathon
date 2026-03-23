import React, { useState } from 'react';
import { Cloud, Sun, Moon, CloudRain, Wind, Droplets, CloudSnow, CloudLightning, CloudFog, CloudDrizzle, ChevronDown, ChevronUp, MapPin, Thermometer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTranslation, dayNames, monthNames, type SupportedLanguage } from '@/lib/translations';
import { motion, AnimatePresence } from 'framer-motion';

interface WeatherData {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  daily?: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
}

interface WeatherDashboardProps {
  data: WeatherData | null;
  loading: boolean;
  error: string | null;
  language?: string;
  lastUpdated?: number | null;
  compact?: boolean;
}

// Weather icon components
const WeatherIcon: React.FC<{ code: number; size?: 'sm' | 'md' | 'lg'; isNight?: boolean }> = ({ code, size = 'md', isNight = false }) => {
  const iconClass = cn(
    size === 'sm' ? 'w-5 h-5' : size === 'md' ? 'w-8 h-8' : 'w-12 h-12',
    'drop-shadow-sm'
  );

  // Map weather codes to icons with appropriate colors
  if (code === 0) return isNight ? <Moon className={cn(iconClass, 'text-blue-200')} /> : <Sun className={cn(iconClass, 'text-yellow-400')} />;
  if (code === 1) return isNight ? <Moon className={cn(iconClass, 'text-blue-100')} /> : <Sun className={cn(iconClass, 'text-yellow-300')} />;
  if (code === 2) return <Cloud className={cn(iconClass, 'text-blue-300')} />;
  if (code === 3) return <Cloud className={cn(iconClass, 'text-slate-400')} />;
  if (code >= 45 && code <= 48) return <CloudFog className={cn(iconClass, 'text-slate-300')} />;
  if (code >= 51 && code <= 55) return <CloudDrizzle className={cn(iconClass, 'text-blue-200')} />;
  if (code >= 56 && code <= 57) return <CloudDrizzle className={cn(iconClass, 'text-blue-100')} />;
  if (code >= 61 && code <= 65) return <CloudRain className={cn(iconClass, 'text-blue-400')} />;
  if (code >= 66 && code <= 67) return <CloudRain className={cn(iconClass, 'text-blue-300')} />;
  if (code >= 71 && code <= 77) return <CloudSnow className={cn(iconClass, 'text-white')} />;
  if (code >= 80 && code <= 82) return <CloudRain className={cn(iconClass, 'text-blue-500')} />;
  if (code >= 85 && code <= 86) return <CloudSnow className={cn(iconClass, 'text-slate-200')} />;
  if (code >= 95 && code <= 99) return <CloudLightning className={cn(iconClass, 'text-amber-500')} />;

  return <Cloud className={iconClass} />;
};

const getWeatherLabel = (code: number, t: any): string => {
  if (code === 0) return t.clearSky;
  if (code === 1) return t.mainlyClear;
  if (code === 2) return t.partlyCloudy;
  if (code === 3) return t.overcast;
  if (code >= 45 && code <= 48) return t.foggy;
  if (code >= 51 && code <= 57) return t.lightDrizzle;
  if (code >= 61 && code <= 67) return t.slightRain;
  if (code >= 71 && code <= 77) return t.snow;
  if (code >= 80 && code <= 82) return t.rainShowers;
  if (code >= 85 && code <= 86) return t.snow;
  if (code >= 95 && code <= 99) return t.thunderstorm;
  return t.unknown;
};

const formatDate = (dateStr: string, language: string): { day: string; date: string; month: string } => {
  let date;
  if (dateStr.includes('T')) {
    date = new Date(dateStr);
  } else {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    } else {
      date = new Date(dateStr);
    }
  }

  const dayIndex = date.getDay();
  const monthIndex = date.getMonth();
  const dateNum = date.getDate();

  const lang = (language as SupportedLanguage) || 'en';
  const days = dayNames[lang] || dayNames.en;
  const months = monthNames[lang] || monthNames.en;

  return {
    day: days[dayIndex],
    date: dateNum.toString(),
    month: months[monthIndex],
  };
};

export const WeatherDashboard: React.FC<WeatherDashboardProps> = ({
  data,
  loading,
  error,
  language = 'en',
  lastUpdated,
  compact = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const t = getTranslation('weather', language);

  if (loading) {
    return (
      <div className="bg-card/50 backdrop-blur-md rounded-[28px] p-6 border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div className="w-24 h-4 bg-muted rounded-full" />
          <div className="w-12 h-12 bg-muted rounded-full" />
        </div>
        <div className="w-20 h-8 bg-muted rounded-lg mb-2" />
        <div className="w-32 h-4 bg-muted rounded-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-destructive/5 backdrop-blur-md rounded-[28px] p-6 border border-destructive/20 text-center">
        <Cloud size={32} className="mx-auto text-destructive/40 mb-2" />
        <p className="text-[11px] font-bold uppercase tracking-widest text-destructive/60">{t.unavailable}</p>
      </div>
    );
  }

  const currentLabel = getWeatherLabel(data.current.weather_code, t);
  const today = new Date();
  const currentHour = today.getHours();
  const isNight = currentHour >= 18 || currentHour < 6;
  const todayDateStr = data.daily?.time?.[0] || today.toISOString().split('T')[0];
  const formattedToday = formatDate(todayDateStr, language);

  return (
    <div className="relative group">
      {/* Premium Glass Card - Tactical Upgrade */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "bg-card/40 backdrop-blur-xl rounded-[32px] transition-all duration-500 cursor-pointer overflow-hidden border border-white/10",
          isExpanded ? "ring-2 ring-primary/30 shadow-2xl" : "shadow-apple-card"
        )}
      >
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div
                  className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20"
                >
                  <span className="text-[9px] font-black uppercase tracking-[0.1em] text-primary">{t.liveWeather}</span>
                </div>
                {lastUpdated && (
                  <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">
                    {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <h3 className="text-[15px] font-extrabold text-foreground tracking-tight">
                {formattedToday.day}, {formattedToday.month} {formattedToday.date}
              </h3>
              <div className="flex items-baseline gap-2.5">
                <span className="text-4xl font-black tracking-tighter text-foreground">
                  {Math.round(data.current.temperature_2m)}°
                </span>
                <span className="text-[14px] font-bold text-muted-foreground/80 leading-none">
                  / {t.realFeel} {Math.round(data.current.temperature_2m + 2)}°
                </span>
              </div>
              <p className="text-[12px] font-semibold text-muted-foreground/90 italic leading-none">{currentLabel}</p>
            </div>

            <div
              className="relative"
            >
              <div className="relative z-10 p-4 bg-white/5 dark:bg-black/20 backdrop-blur-md rounded-3xl border border-white/10 shadow-apple-lg">
                <WeatherIcon code={data.current.weather_code} size="lg" isNight={isNight} />
              </div>
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full -z-0 opacity-50" />
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-5 border-t border-border/10">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10">
                  <Droplets size={16} className="text-blue-500" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-0.5">Humidity</span>
                  <span className="text-[13px] font-black text-foreground">{data.current.relative_humidity_2m}%</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-teal-500/10">
                  <Wind size={16} className="text-teal-500" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-0.5">Wind</span>
                  <span className="text-[13px] font-black text-foreground">{data.current.wind_speed_10m} km/h</span>
                </div>
              </div>
            </div>
            <div
              className="p-1 rounded-full bg-muted/30"
            >
              <ChevronDown size={20} className={cn("text-muted-foreground/60 transition-transform", isExpanded && "rotate-180")} />
            </div>
          </div>
        </div>

        {/* Forecast Content */}
        <AnimatePresence>
          {isExpanded && data.daily && (
            <div
              className="px-6 pb-8"
            >
              <div className="pt-4">
                <div className="flex justify-between items-center mb-5">
                  <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/70">{t.next5Days}</h4>
                </div>
                <div className="grid grid-cols-5 gap-3">
                  {data.daily.time.slice(0, 5).map((time, idx) => {
                    const dateInfo = formatDate(time, language);
                    const isToday = idx === 0;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "flex flex-col items-center p-3 rounded-[24px] border transition-all duration-300",
                          isToday
                            ? "bg-primary/10 border-primary/30 shadow-apple-sm ring-1 ring-primary/20"
                            : "bg-muted/10 border-white/5"
                        )}
                      >
                        <p className={cn("text-[9px] font-black uppercase tracking-widest mb-2.5", isToday ? "text-primary" : "text-muted-foreground")}>
                          {isToday ? t.today : dateInfo.day.slice(0, 3)}
                        </p>
                        <WeatherIcon code={data.daily!.weather_code[idx]} size="sm" isNight={false} />
                        <div className="mt-3 flex flex-col items-center leading-none">
                          <p className="text-[14px] font-black text-foreground">{Math.round(data.daily!.temperature_2m_max[idx])}°</p>
                          <p className="text-[10px] text-muted-foreground/60 font-bold mt-1">{Math.round(data.daily!.temperature_2m_min[idx])}°</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
