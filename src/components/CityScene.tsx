"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createWindowAtlas, FocusBeacon } from "./Building3D";
import InstancedBuildings from "./InstancedBuildings";
import InstancedLabels from "./InstancedLabels";
import EffectsLayer from "./EffectsLayer";
import LiveDots from "./LiveDots";
import type { LiveSession } from "@/lib/useCodingPresence";
import type { CityBuilding } from "@/lib/github";
import type { BuildingColors } from "./CityCanvas";

const GRID_CELL_SIZE = 200;
const WEATHER_PARTICLE_COUNT = 900;
const WEATHER_AREA = 2200;
const WEATHER_TOP = 420;
const WEATHER_BOTTOM = 10;
const pseudoRandom = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453123;
  return x - Math.floor(x);
};

// Pre-allocated temp vector for focus info projection
const _position = new THREE.Vector3();

export interface FocusInfo {
  dist: number;
  screenX: number;
  screenY: number;
}

// ─── Spatial Grid ───────────────────────────────────────────────

interface GridIndex {
  cells: Map<string, number[]>;
  cellSize: number;
}

function buildSpatialGrid(buildings: CityBuilding[], cellSize: number): GridIndex {
  const cells = new Map<string, number[]>();
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const cx = Math.floor(b.position[0] / cellSize);
    const cz = Math.floor(b.position[2] / cellSize);
    const key = `${cx},${cz}`;
    let arr = cells.get(key);
    if (!arr) {
      arr = [];
      cells.set(key, arr);
    }
    arr.push(i);
  }
  return { cells, cellSize };
}

// ─── Pre-computed building data ─────────────────────────────────

interface BuildingLookup {
  indexByLogin: Map<string, number>;
}

function buildLookup(buildings: CityBuilding[]): BuildingLookup {
  const indexByLogin = new Map<string, number>();
  for (let i = 0; i < buildings.length; i++) {
    indexByLogin.set(buildings[i].login.toLowerCase(), i);
  }
  return { indexByLogin };
}

// ─── Component ──────────────────────────────────────────────────

interface CitySceneProps {
  buildings: CityBuilding[];
  colors: BuildingColors;
  focusedBuilding?: string | null;
  focusedBuildingB?: string | null;
  hideEffectsFor?: string | null;
  accentColor?: string;
  onBuildingClick?: (building: CityBuilding) => void;
  onFocusInfo?: (info: FocusInfo) => void;
  introMode?: boolean;
  flyMode?: boolean;
  ghostPreviewLogin?: string | null;
  holdRise?: boolean;
  liveByLogin?: Map<string, LiveSession>;
  cityEnergy?: number;
}

function RainWeather() {
  const pointsRef = useRef<THREE.Points>(null);
  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(WEATHER_PARTICLE_COUNT * 3);
    const speeds = new Float32Array(WEATHER_PARTICLE_COUNT);
    for (let i = 0; i < WEATHER_PARTICLE_COUNT; i++) {
      const base = i * 3;
      positions[base] = (pseudoRandom(i * 3 + 1) - 0.5) * WEATHER_AREA;
      positions[base + 1] = WEATHER_BOTTOM + pseudoRandom(i * 3 + 2) * (WEATHER_TOP - WEATHER_BOTTOM);
      positions[base + 2] = (pseudoRandom(i * 3 + 3) - 0.5) * WEATHER_AREA;
      speeds[i] = 120 + pseudoRandom(i * 3 + 4) * 150;
    }
    return { positions, speeds };
  }, []);

  useFrame((state, delta) => {
    const pts = pointsRef.current;
    if (!pts) return;
    const arr = (pts.geometry.attributes.position.array as Float32Array);
    const tick = Math.floor(state.clock.elapsedTime * 60);
    for (let i = 0; i < WEATHER_PARTICLE_COUNT; i++) {
      const base = i * 3;
      arr[base + 1] -= speeds[i] * delta;
      if (arr[base + 1] < WEATHER_BOTTOM) {
        arr[base] = (pseudoRandom(i * 17 + tick) - 0.5) * WEATHER_AREA;
        arr[base + 1] = WEATHER_TOP;
        arr[base + 2] = (pseudoRandom(i * 19 + tick * 2) - 0.5) * WEATHER_AREA;
      }
    }
    pts.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#a7c7ff" size={2} sizeAttenuation transparent opacity={0.45} depthWrite={false} />
    </points>
  );
}

export default function CityScene({
  buildings,
  colors,
  focusedBuilding,
  focusedBuildingB,
  hideEffectsFor,
  accentColor,
  onBuildingClick,
  onFocusInfo,
  introMode,
  flyMode,
  ghostPreviewLogin,
  holdRise,
  liveByLogin,
  cityEnergy,
}: CitySceneProps) {
  // Single atlas texture for all building windows (created once per theme)
  const atlasTexture = useMemo(() => createWindowAtlas(colors), [colors]);

  // Spatial grid for effects LOD
  const grid = useMemo(() => buildSpatialGrid(buildings, GRID_CELL_SIZE), [buildings]);

  // Lookup for focus info emission
  const lookup = useMemo(() => buildLookup(buildings), [buildings]);

  // Cache focus names
  const focusedLower = focusedBuilding?.toLowerCase() ?? null;
  const focusedBLower = focusedBuildingB?.toLowerCase() ?? null;

  // Focused building data (for FocusBeacon positioning)
  const focusedBuildingData = useMemo(() => {
    if (!focusedLower) return null;
    const idx = lookup.indexByLogin.get(focusedLower);
    if (idx === undefined) return null;
    return buildings[idx];
  }, [focusedLower, lookup, buildings]);

  const focusedBuildingBData = useMemo(() => {
    if (!focusedBLower) return null;
    const idx = lookup.indexByLogin.get(focusedBLower);
    if (idx === undefined) return null;
    return buildings[idx];
  }, [focusedBLower, lookup, buildings]);

  const lastFocusUpdate = useRef(-1);

  // Emit focus info for focused buildings (throttled to 5Hz)
  useFrame(({ camera, clock, size }) => {
    const elapsed = clock.elapsedTime;
    if (elapsed - lastFocusUpdate.current < 0.2) return;
    lastFocusUpdate.current = elapsed;

    if (!onFocusInfo || (!focusedLower && !focusedBLower)) return;

    const fi = focusedLower ? lookup.indexByLogin.get(focusedLower) : undefined;
    const fbi = focusedBLower ? lookup.indexByLogin.get(focusedBLower) : undefined;
    const targetIdx = fi ?? fbi;
    if (targetIdx === undefined) return;

    const b = buildings[targetIdx];
    const dx = camera.position.x - b.position[0];
    const dz = camera.position.z - b.position[2];
    const dist = Math.sqrt(dx * dx + dz * dz);
    _position.set(b.position[0], b.height * 0.65, b.position[2]);
    _position.project(camera);
    const screenX = (_position.x * 0.5 + 0.5) * size.width;
    const screenY = (-_position.y * 0.5 + 0.5) * size.height;
    onFocusInfo({ dist, screenX, screenY });
  });

  // Dispose atlas on theme change
  useEffect(() => {
    return () => atlasTexture.dispose();
  }, [atlasTexture]);

  return (
    <>
      {/* All buildings: single instanced draw call with custom shader */}
      <InstancedBuildings
        buildings={buildings}
        colors={colors}
        atlasTexture={atlasTexture}
        focusedBuilding={focusedBuilding}
        focusedBuildingB={focusedBuildingB}
        introMode={introMode}
        onBuildingClick={onBuildingClick}
        holdRise={holdRise}
        liveByLogin={liveByLogin}
        cityEnergy={cityEnergy}
      />

      {/* Live presence dots above active buildings */}
      {liveByLogin && liveByLogin.size > 0 && (
        <LiveDots buildings={buildings} liveByLogin={liveByLogin} />
      )}

      {/* All labels: single instanced draw call with billboard shader */}
      <InstancedLabels
        buildings={buildings}
        introMode={introMode}
        flyMode={flyMode}
        focusedBuilding={focusedBuilding}
        focusedBuildingB={focusedBuildingB}
      />

      {/* Effects: React components only for nearby buildings with items */}
      <EffectsLayer
        buildings={buildings}
        grid={grid}
        colors={colors}
        accentColor={accentColor ?? colors.accent ?? "#ffa116"}
        focusedBuilding={focusedBuilding}
        focusedBuildingB={focusedBuildingB}
        hideEffectsFor={hideEffectsFor}
        introMode={introMode}
        flyMode={flyMode}
        ghostPreviewLogin={ghostPreviewLogin}
      />

      {!introMode && <RainWeather />}

      {/* FocusBeacon: standalone, only when a building is focused */}
      {!introMode && focusedBuildingData && (
        <group position={[focusedBuildingData.position[0], 0, focusedBuildingData.position[2]]}>
          <FocusBeacon
            height={focusedBuildingData.height}
            width={focusedBuildingData.width}
            depth={focusedBuildingData.depth}
            accentColor={accentColor ?? "#ffa116"}
          />
        </group>
      )}

      {!introMode && focusedBuildingBData && focusedBuildingBData !== focusedBuildingData && (
        <group position={[focusedBuildingBData.position[0], 0, focusedBuildingBData.position[2]]}>
          <FocusBeacon
            height={focusedBuildingBData.height}
            width={focusedBuildingBData.width}
            depth={focusedBuildingBData.depth}
            accentColor={accentColor ?? "#ffa116"}
          />
        </group>
      )}
    </>
  );
}
