import {
  getWindParticleBudget,
  mapConditionToWeatherMode,
  normalizeWeatherCondition,
} from "../weather";

describe("weather helpers", () => {
  it("normalizes weather provider condition strings", () => {
    expect(normalizeWeatherCondition("  Windy  ")).toBe("windy");
    expect(normalizeWeatherCondition(null)).toBe("");
  });

  it("maps windy provider conditions and high wind speeds to windy mode", () => {
    expect(mapConditionToWeatherMode("Squall")).toBe("windy");
    expect(mapConditionToWeatherMode("Clear", 9)).toBe("windy");
  });

  it("keeps rainy and clear fallback modes distinct", () => {
    expect(mapConditionToWeatherMode("Rain")).toBe("rain");
    expect(mapConditionToWeatherMode("Mist")).toBe("clear");
  });

  it("caps wind particle budgets and reduces mobile load", () => {
    const desktop = getWindParticleBudget({ intensity: 2 });
    const mobile = getWindParticleBudget({ isMobile: true, intensity: 2 });

    expect(desktop.streaks).toBeLessThanOrEqual(588);
    expect(desktop.debris).toBeLessThanOrEqual(168);
    expect(mobile.streaks).toBeLessThan(desktop.streaks);
    expect(mobile.debris).toBeLessThan(desktop.debris);
    expect(mobile.dustBands).toBeLessThan(desktop.dustBands);
  });
});
