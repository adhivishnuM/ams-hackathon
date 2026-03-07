import React, { useState } from 'react';
import { Cloud, Sun, Moon, CloudRain, Wind, Droplets, CloudSnow, CloudLightning, CloudFog, CloudDrizzle, ChevronDown, ChevronUp, MapPin, Thermometer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTranslation, dayNames, monthNames, type SupportedLanguage } from '@/lib/translations';

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
    'drop-shadow-sm transition-transform duration-500 hover:scale-110'
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
  const date = new Date(dateStr);
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
      <div className="bg-card/50 backdrop-blur-md rounded-[28px] p-6 border border-border/50 animate-pulse">
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
  const formattedToday = formatDate(today.toISOString(), language);

  return (
    <div className="relative group">
      {/* Premium Glass Card - Tactical Upgrade */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "bg-card rounded-[32px] transition-all duration-500 cursor-pointer overflow-hidden border border-border",
          "hover:shadow-2xl hover:scale-[1.01] active:scale-[0.98]",
          isExpanded ? "ring-2 ring-primary/40 shadow-apple-lg" : "shadow-xl"
        )}
      >
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <div className="px-1.5 py-0.5 rounded-full bg-muted border border-border">
                  <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">{t.liveWeather}</span>
                </div>
                {lastUpdated && (
                  <span className="text-[8px] font-bold text-muted-foreground/60 uppercase">
                    • {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <h3 className="text-[13px] font-bold text-foreground tracking-tight">
                {formattedToday.day}, {formattedToday.month} {formattedToday.date}
              </h3>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black tracking-tighter text-foreground">
                  {Math.round(data.current.temperature_2m)}°
                </span>
                <span className="text-[11px] font-bold text-muted-foreground leading-none">
                  / {t.realFeel} {Math.round(data.current.temperature_2m + 2)}°
                </span>
              </div>
              <p className="text-[11px] font-medium text-muted-foreground italic leading-none">{currentLabel}</p>
            </div>

            <div className="relative">
              <div className="relative z-10 p-2 bg-muted/50 rounded-2xl border border-border shadow-apple-sm">
                <WeatherIcon code={data.current.weather_code} size="md" isNight={isNight} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Droplets size={14} className="text-blue-500" />
                <span className="text-[11px] font-bold text-foreground">{data.current.relative_humidity_2m}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Wind size={14} className="text-teal-500" />
                <span className="text-[11px] font-bold text-foreground">{data.current.wind_speed_10m} km/h</span>
              </div>
            </div>
            <div className={cn("transition-transform duration-500", isExpanded && "rotate-180")}>
              <ChevronDown size={16} className="text-muted-foreground/60" />
            </div>
          </div>
        </div>

        {/* Forecast Content */}
        {isExpanded && data.daily && (
          <div className="px-6 pb-6 animate-in slide-in-from-top-4 duration-500">
            <div className="pt-2">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/80">{t.next5Days}</h4>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {data.daily.time.slice(0, 5).map((time, idx) => {
                  const dateInfo = formatDate(time, language);
                  const isToday = idx === 0;
                  return (
                    <div key={idx} className={cn(
                      "flex flex-col items-center p-2 rounded-2xl border transition-all duration-300",
                      isToday
                        ? "bg-primary/5 border-primary/20 shadow-apple-sm"
                        : "bg-muted/20 border-border/30 hover:bg-muted/40"
                    )}>
                      <p className={cn("text-[8px] font-black uppercase tracking-widest mb-1.5", isToday ? "text-primary" : "text-muted-foreground")}>
                        {isToday ? t.today : dateInfo.day.slice(0, 3)}
                      </p>
                      <WeatherIcon code={data.daily!.weather_code[idx]} size="sm" isNight={false} />
                      <p className="text-[12px] font-bold text-foreground mt-1.5">{Math.round(data.daily!.temperature_2m_max[idx])}°</p>
                      <p className="text-[9px] text-muted-foreground/60 font-medium">{Math.round(data.daily!.temperature_2m_min[idx])}°</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
