import React from 'react';

interface ActionToolbarProps {
  cycleTheme: () => void;
  replayIntro: () => void;
  theme: {
    accent: string;
    name: string;
  };
  themeIndex: number;
  themesLength: number;
  isMounted: boolean;
  cycleWeather?: () => void;
  weatherMode?: "clear" | "rain" | "fog" | "live";
}

const ActionToolbar: React.FC<ActionToolbarProps> = ({
  cycleTheme,
  replayIntro,
  theme,
  themeIndex,
  themesLength,
  isMounted,
  cycleWeather,
  weatherMode = "clear",
}) => {
  return (
    <div className="flex items-center gap-2">
      {/* Theme Cycle Button */}
      <button
        onClick={cycleTheme}
        className="btn-press flex items-center gap-1.5 border-[3px] border-border bg-bg/70 px-2.5 py-1 text-[10px] backdrop-blur-sm transition-colors hover:border-border-light"
      >
        <span style={{ color: theme.accent }}>&#9654;</span>
        <span className="text-cream">{theme.name}</span>
        <span className="text-dim">{themeIndex + 1}/{themesLength}</span>
      </button>

      {/* Weather Cycle Button */}
      {cycleWeather && (
        <button
          onClick={cycleWeather}
          className="btn-press flex items-center gap-1.5 border-[3px] border-border bg-bg/70 px-2.5 py-1 text-[10px] backdrop-blur-sm transition-colors hover:border-border-light"
          title="Cycle weather"
        >
          <span style={{ color: theme.accent }}>
            {weatherMode === "clear" && "☀️"}
            {weatherMode === "rain" && "🌧️"}
            {weatherMode === "fog" && "🌫️"}
            {weatherMode === "live" && "📡"}
          </span>
          <span className="text-cream">
            {weatherMode === "clear" && "CLEAR"}
            {weatherMode === "rain" && "RAIN"}
            {weatherMode === "fog" && "FOG"}
            {weatherMode === "live" && "LIVE"}
          </span>
        </button>
      )}

      {/* Audio/Radio Slot if mounted */}
      {isMounted && <div id="gc-radio-slot" />}

      {/* Replay Intro Button */}
      <button
        onClick={replayIntro}
        className="btn-press flex items-center gap-1 border-[3px] border-border bg-bg/70 px-2 py-1 text-[10px] backdrop-blur-sm transition-colors hover:border-border-light"
        title="Replay intro"
      >
        <span style={{ color: theme.accent }}>&#9654;</span>
        <span className="text-cream">Intro</span>
      </button>
    </div>
  );
};

export default ActionToolbar;