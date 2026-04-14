"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "@/components/garage/language-toggle";

// Sant Climent de Llobregat coordinates
const LAT = 41.3487;
const LON = 2.0052;

// WMO weather codes → icon + label
const WEATHER_INFO: Record<
  number,
  { icon: string; en: string; es: string; nl: string }
> = {
  0: { icon: "☀️", en: "Clear sky", es: "Cielo despejado", nl: "Onbewolkt" },
  1: { icon: "🌤️", en: "Mainly clear", es: "Mayormente despejado", nl: "Overwegend helder" },
  2: { icon: "⛅", en: "Partly cloudy", es: "Parcialmente nublado", nl: "Half bewolkt" },
  3: { icon: "☁️", en: "Overcast", es: "Nublado", nl: "Bewolkt" },
  45: { icon: "🌫️", en: "Fog", es: "Niebla", nl: "Mist" },
  48: { icon: "🌫️", en: "Rime fog", es: "Niebla helada", nl: "Rijpmist" },
  51: { icon: "🌦️", en: "Light drizzle", es: "Llovizna ligera", nl: "Lichte motregen" },
  53: { icon: "🌦️", en: "Drizzle", es: "Llovizna", nl: "Motregen" },
  55: { icon: "🌧️", en: "Dense drizzle", es: "Llovizna intensa", nl: "Dichte motregen" },
  61: { icon: "🌧️", en: "Light rain", es: "Lluvia ligera", nl: "Lichte regen" },
  63: { icon: "🌧️", en: "Rain", es: "Lluvia", nl: "Regen" },
  65: { icon: "🌧️", en: "Heavy rain", es: "Lluvia intensa", nl: "Zware regen" },
  71: { icon: "🌨️", en: "Light snow", es: "Nieve ligera", nl: "Lichte sneeuw" },
  73: { icon: "🌨️", en: "Snow", es: "Nieve", nl: "Sneeuw" },
  75: { icon: "🌨️", en: "Heavy snow", es: "Nieve intensa", nl: "Zware sneeuw" },
  80: { icon: "🌦️", en: "Rain showers", es: "Chubascos", nl: "Regenbuien" },
  81: { icon: "🌧️", en: "Moderate showers", es: "Chubascos moderados", nl: "Matige buien" },
  82: { icon: "⛈️", en: "Heavy showers", es: "Chubascos fuertes", nl: "Zware buien" },
  95: { icon: "⛈️", en: "Thunderstorm", es: "Tormenta", nl: "Onweer" },
  96: { icon: "⛈️", en: "Thunderstorm + hail", es: "Tormenta con granizo", nl: "Onweer + hagel" },
  99: { icon: "⛈️", en: "Thunderstorm + heavy hail", es: "Tormenta con granizo fuerte", nl: "Zwaar onweer + hagel" },
};

type WeatherData = {
  temperature: number;
  windSpeed: number;
  weatherCode: number;
  humidity: number;
  feelsLike: number;
  forecast: { time: string; tempMax: number; tempMin: number; weatherCode: number }[];
};

export function WeatherWidget() {
  const { t } = useLanguage();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchWeather() {
      try {
        const url = new URL("https://api.open-meteo.com/v1/forecast");
        url.searchParams.set("latitude", String(LAT));
        url.searchParams.set("longitude", String(LON));
        url.searchParams.set(
          "current",
          "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m"
        );
        url.searchParams.set(
          "daily",
          "weather_code,temperature_2m_max,temperature_2m_min"
        );
        url.searchParams.set("forecast_days", "3");
        url.searchParams.set("timezone", "Europe/Madrid");

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error("Weather fetch failed");
        const data = await res.json();

        setWeather({
          temperature: Math.round(data.current.temperature_2m),
          windSpeed: Math.round(data.current.wind_speed_10m),
          weatherCode: data.current.weather_code,
          humidity: data.current.relative_humidity_2m,
          feelsLike: Math.round(data.current.apparent_temperature),
          forecast: data.daily.time.slice(1).map((time: string, i: number) => ({
            time,
            tempMax: Math.round(data.daily.temperature_2m_max[i + 1]),
            tempMin: Math.round(data.daily.temperature_2m_min[i + 1]),
            weatherCode: data.daily.weather_code[i + 1],
          })),
        });
      } catch {
        setError(true);
      }
    }

    fetchWeather();
    // Refresh weather every 15 min
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (error || !weather) {
    if (error) return null;
    // Loading skeleton
    return (
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 animate-pulse">
        <div className="h-3 w-20 rounded bg-gray-100 mb-3" />
        <div className="h-8 w-14 rounded bg-gray-100" />
      </div>
    );
  }

  const info = WEATHER_INFO[weather.weatherCode] ?? WEATHER_INFO[0]!;
  const label = t(info.en, info.es, info.nl);

  const dayNames: Record<string, { en: string; es: string; nl: string }> = {};
  weather.forecast.forEach((f) => {
    const d = new Date(f.time + "T12:00:00");
    const dow = d.getDay();
    const names = [
      { en: "Sun", es: "Dom", nl: "Zo" },
      { en: "Mon", es: "Lun", nl: "Ma" },
      { en: "Tue", es: "Mar", nl: "Di" },
      { en: "Wed", es: "Mié", nl: "Wo" },
      { en: "Thu", es: "Jue", nl: "Do" },
      { en: "Fri", es: "Vie", nl: "Vr" },
      { en: "Sat", es: "Sáb", nl: "Za" },
    ];
    dayNames[f.time] = names[dow];
  });

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-5 max-w-sm">
      {/* Location */}
      <p className="text-xs font-medium text-sky-700 uppercase tracking-wider mb-3">
        📍 Sant Climent
      </p>

      {/* Current weather */}
      <div className="flex items-center gap-3">
        <span className="text-3xl">{info.icon}</span>
        <div>
          <span className="text-3xl font-semibold text-gray-900 tabular-nums">{weather.temperature}°</span>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>

      {/* Forecast */}
      {weather.forecast.length > 0 && (
        <div className="flex gap-4 mt-4 pt-3 border-t border-gray-100">
          {weather.forecast.map((f) => {
            const fInfo = WEATHER_INFO[f.weatherCode] ?? WEATHER_INFO[0]!;
            const dn = dayNames[f.time];
            return (
              <div key={f.time} className="text-center">
                <p className="text-xs text-gray-400 font-medium">
                  {dn ? t(dn.en, dn.es, dn.nl) : f.time.slice(5)}
                </p>
                <p className="text-base my-0.5">{fInfo.icon}</p>
                <p className="text-xs tabular-nums text-gray-500">
                  <span className="font-medium text-gray-700">{f.tempMax}°</span>
                  <span className="text-gray-400 ml-0.5">{f.tempMin}°</span>
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
