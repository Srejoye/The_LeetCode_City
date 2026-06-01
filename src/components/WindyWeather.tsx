"use client";

import { useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getWindParticleBudget } from "@/lib/weather";

const WIND_AREA = 2600;
const WIND_HALF_AREA = WIND_AREA / 2;
const WIND_BOTTOM = 14;
const WIND_TOP = 380;
const WIND_RESPAWN_X_SEED = 23;
const WIND_RESPAWN_Z_SEED = 29;
const WIND_RESPAWN_CYCLE_SEED = 37;
const PRNG_MULTIPLIER = 12.9898;
const PRNG_SCALE = 43758.5453123;

interface WindState {
  streakPositions: Float32Array;
  streakSpeeds: Float32Array;
  streakLengths: Float32Array;
  streakAnchorX: Float32Array;
  streakAnchorY: Float32Array;
  streakAnchorZ: Float32Array;
  streakCycles: Uint32Array;
  debrisPositions: Float32Array;
  debrisColors: Float32Array;
  debrisSpeeds: Float32Array;
  debrisAnchorX: Float32Array;
  debrisAnchorY: Float32Array;
  debrisAnchorZ: Float32Array;
  debrisCycles: Uint32Array;
}

function pseudoRandom(seed: number) {
  const value = Math.sin(seed * PRNG_MULTIPLIER) * PRNG_SCALE;
  return value - Math.floor(value);
}

function wrapAroundCenter(value: number, center: number) {
  const wrapped =
    ((value - center + WIND_HALF_AREA) % WIND_AREA + WIND_AREA) % WIND_AREA;
  return center + wrapped - WIND_HALF_AREA;
}

function createWindState(centerX: number, centerZ: number, isMobile: boolean): WindState {
  const budget = getWindParticleBudget({ isMobile, intensity: 1.15 });
  const streakPositions = new Float32Array(budget.streaks * 2 * 3);
  const streakSpeeds = new Float32Array(budget.streaks);
  const streakLengths = new Float32Array(budget.streaks);
  const streakAnchorX = new Float32Array(budget.streaks);
  const streakAnchorY = new Float32Array(budget.streaks);
  const streakAnchorZ = new Float32Array(budget.streaks);
  const streakCycles = new Uint32Array(budget.streaks);

  for (let i = 0; i < budget.streaks; i++) {
    streakAnchorX[i] = centerX + (pseudoRandom(i * 5 + 1) - 0.5) * WIND_AREA;
    streakAnchorY[i] = WIND_BOTTOM + pseudoRandom(i * 5 + 2) * (WIND_TOP - WIND_BOTTOM);
    streakAnchorZ[i] = centerZ + (pseudoRandom(i * 5 + 3) - 0.5) * WIND_AREA;
    streakSpeeds[i] = 180 + pseudoRandom(i * 5 + 4) * 210;
    streakLengths[i] = 38 + pseudoRandom(i * 5 + 5) * 56;
  }

  const debrisPositions = new Float32Array(budget.debris * 3);
  const debrisColors = new Float32Array(budget.debris * 3);
  const debrisSpeeds = new Float32Array(budget.debris);
  const debrisAnchorX = new Float32Array(budget.debris);
  const debrisAnchorY = new Float32Array(budget.debris);
  const debrisAnchorZ = new Float32Array(budget.debris);
  const debrisCycles = new Uint32Array(budget.debris);

  const palette = [
    new THREE.Color("#d6a64f"),
    new THREE.Color("#8fbf5a"),
    new THREE.Color("#c9c2a4"),
    new THREE.Color("#b8793b"),
  ];

  for (let i = 0; i < budget.debris; i++) {
    const color = palette[i % palette.length];
    const base = i * 3;
    debrisAnchorX[i] = centerX + (pseudoRandom(i * 7 + 1) - 0.5) * WIND_AREA;
    debrisAnchorY[i] = WIND_BOTTOM + pseudoRandom(i * 7 + 2) * 95;
    debrisAnchorZ[i] = centerZ + (pseudoRandom(i * 7 + 3) - 0.5) * WIND_AREA;
    debrisPositions[base] = debrisAnchorX[i];
    debrisPositions[base + 1] = debrisAnchorY[i];
    debrisPositions[base + 2] = debrisAnchorZ[i];
    debrisColors[base] = color.r;
    debrisColors[base + 1] = color.g;
    debrisColors[base + 2] = color.b;
    debrisSpeeds[i] = 90 + pseudoRandom(i * 7 + 4) * 130;
  }

  return {
    streakPositions,
    streakSpeeds,
    streakLengths,
    streakAnchorX,
    streakAnchorY,
    streakAnchorZ,
    streakCycles,
    debrisPositions,
    debrisColors,
    debrisSpeeds,
    debrisAnchorX,
    debrisAnchorY,
    debrisAnchorZ,
    debrisCycles,
  };
}

function GroundDustBands({ isMobile }: { isMobile: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const bandCount = getWindParticleBudget({ isMobile }).dustBands;

  useFrame(({ clock, camera }) => {
    if (!groupRef.current) return;
    groupRef.current.position.x = camera.position.x;
    groupRef.current.position.z = camera.position.z;

    groupRef.current.children.forEach((child, index) => {
      const mesh = child as THREE.Mesh;
      const offset = ((clock.elapsedTime * (48 + index * 7)) % WIND_AREA) - WIND_HALF_AREA;
      mesh.position.x = -WIND_HALF_AREA + offset + index * 170;
      mesh.position.z = -WIND_HALF_AREA + ((index * 420) % WIND_AREA);
      mesh.rotation.z = Math.sin(clock.elapsedTime * 0.3 + index) * 0.04;
    });
  });

  return (
    <group ref={groupRef} name="wind-ground-dust">
      {Array.from({ length: bandCount }).map((_, index) => (
        <mesh
          key={index}
          position={[
            -WIND_HALF_AREA + index * 240,
            8 + (index % 3) * 4,
            -WIND_HALF_AREA + ((index * 420) % WIND_AREA),
          ]}
          rotation={[-Math.PI / 2, 0, -0.16]}
        >
          <planeGeometry args={[520, 70, 1, 1]} />
          <meshBasicMaterial
            color="#c7b184"
            transparent
            opacity={0.075}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function WindyWeather() {
  const swayRef = useRef<THREE.Group>(null);
  const streaksRef = useRef<THREE.LineSegments>(null);
  const debrisRef = useRef<THREE.Points>(null);
  const { camera, size } = useThree();
  const isMobile = size.width < 768;
  const [initialState] = useState(() =>
    createWindState(camera.position.x, camera.position.z, isMobile),
  );
  const streakAnchorXRef = useRef(initialState.streakAnchorX);
  const streakAnchorYRef = useRef(initialState.streakAnchorY);
  const streakAnchorZRef = useRef(initialState.streakAnchorZ);
  const streakCyclesRef = useRef(initialState.streakCycles);
  const debrisAnchorXRef = useRef(initialState.debrisAnchorX);
  const debrisAnchorYRef = useRef(initialState.debrisAnchorY);
  const debrisAnchorZRef = useRef(initialState.debrisAnchorZ);
  const debrisCyclesRef = useRef(initialState.debrisCycles);

  useFrame((state, delta) => {
    if (swayRef.current) {
      swayRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.72) * 0.018;
    }

    const streaks = streaksRef.current;
    const debris = debrisRef.current;
    const centerX = state.camera.position.x;
    const centerZ = state.camera.position.z;
    const gust = 1 + Math.sin(state.clock.elapsedTime * 0.8) * 0.18;

    if (streaks) {
      const positionArray = streaks.geometry.attributes.position.array as Float32Array;
      const anchorX = streakAnchorXRef.current;
      const anchorY = streakAnchorYRef.current;
      const anchorZ = streakAnchorZRef.current;
      const cycles = streakCyclesRef.current;

      for (let i = 0; i < initialState.streakSpeeds.length; i++) {
        const pointBase = i * 6;
        anchorX[i] += initialState.streakSpeeds[i] * delta * gust;
        anchorZ[i] -= initialState.streakSpeeds[i] * delta * 0.22;

        if (anchorX[i] - centerX > WIND_HALF_AREA) {
          cycles[i] += 1;
          anchorX[i] =
            centerX -
            WIND_HALF_AREA +
            pseudoRandom(i * WIND_RESPAWN_X_SEED + cycles[i]) * 70;
          anchorY[i] =
            WIND_BOTTOM +
            pseudoRandom(i * 11 + cycles[i] * WIND_RESPAWN_CYCLE_SEED) *
              (WIND_TOP - WIND_BOTTOM);
          anchorZ[i] =
            centerZ +
            (pseudoRandom(i * WIND_RESPAWN_Z_SEED + cycles[i]) - 0.5) *
              WIND_AREA;
        }

        const x = wrapAroundCenter(anchorX[i], centerX);
        const y = anchorY[i] + Math.sin(state.clock.elapsedTime * 2 + i) * 4;
        const z = wrapAroundCenter(anchorZ[i], centerZ);
        const length = initialState.streakLengths[i];

        positionArray[pointBase] = x;
        positionArray[pointBase + 1] = y;
        positionArray[pointBase + 2] = z;
        positionArray[pointBase + 3] = x + length;
        positionArray[pointBase + 4] = y + length * 0.05;
        positionArray[pointBase + 5] = z - length * 0.22;
      }
      streaks.geometry.attributes.position.needsUpdate = true;
    }

    if (debris) {
      const positionArray = debris.geometry.attributes.position.array as Float32Array;
      const anchorX = debrisAnchorXRef.current;
      const anchorY = debrisAnchorYRef.current;
      const anchorZ = debrisAnchorZRef.current;
      const cycles = debrisCyclesRef.current;

      for (let i = 0; i < initialState.debrisSpeeds.length; i++) {
        const base = i * 3;
        anchorX[i] += initialState.debrisSpeeds[i] * delta * gust;
        anchorZ[i] -= initialState.debrisSpeeds[i] * delta * 0.16;

        if (anchorX[i] - centerX > WIND_HALF_AREA) {
          cycles[i] += 1;
          anchorX[i] = centerX - WIND_HALF_AREA;
          anchorY[i] = WIND_BOTTOM + pseudoRandom(i * 13 + cycles[i]) * 105;
          anchorZ[i] =
            centerZ +
            (pseudoRandom(i * 17 + cycles[i]) - 0.5) * WIND_AREA;
        }

        positionArray[base] = wrapAroundCenter(anchorX[i], centerX);
        positionArray[base + 1] =
          anchorY[i] + Math.sin(state.clock.elapsedTime * 4 + i) * 9;
        positionArray[base + 2] = wrapAroundCenter(anchorZ[i], centerZ);
      }
      debris.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group ref={swayRef} name="subsystem-windy-weather">
      <GroundDustBands isMobile={isMobile} />

      <lineSegments ref={streaksRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[initialState.streakPositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color="#d7f7ff"
          transparent
          opacity={0.42}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      <points ref={debrisRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[initialState.debrisPositions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[initialState.debrisColors, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={5}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.82}
          depthWrite={false}
        />
      </points>
    </group>
  );
}
