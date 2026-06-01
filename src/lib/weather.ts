export type CityWeatherMode = "clear" | "rain" | "windy";

export interface WindParticleBudgetOptions {
  isMobile?: boolean;
  intensity?: number;
}

export interface WindParticleBudget {
  streaks: number;
  debris: number;
  dustBands: number;
}

const WIND_CONDITIONS = new Set([
  "squall",
  "tornado",
  "wind",
  "windy",
  "breeze",
  "gale",
]);

const RAIN_CONDITIONS = new Set([
  "drizzle",
  "rain",
  "shower rain",
  "thunderstorm",
]);

export function normalizeWeatherCondition(condition: string | null | undefined) {
  return condition?.trim().toLowerCase() ?? "";
}

export function mapConditionToWeatherMode(
  condition: string | null | undefined,
  windSpeedMetersPerSecond = 0,
): CityWeatherMode {
  const normalized = normalizeWeatherCondition(condition);

  if (WIND_CONDITIONS.has(normalized) || windSpeedMetersPerSecond >= 8) {
    return "windy";
  }

  if (RAIN_CONDITIONS.has(normalized)) {
    return "rain";
  }

  return "clear";
}

export function getWindParticleBudget({
  isMobile = false,
  intensity = 1,
}: WindParticleBudgetOptions = {}): WindParticleBudget {
  const clampedIntensity = Math.min(1.4, Math.max(0.4, intensity));
  const mobileFactor = isMobile ? 0.55 : 1;

  return {
    streaks: Math.round(420 * clampedIntensity * mobileFactor),
    debris: Math.round(120 * clampedIntensity * mobileFactor),
    dustBands: isMobile ? 5 : 8,
  };
}
