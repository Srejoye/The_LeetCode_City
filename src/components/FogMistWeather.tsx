"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * ============================================================================
 * FogMistWeather.tsx
 * ============================================================================
 * A highly optimized, GPU-accelerated atmospheric ground fog and mist system.
 * Uses layered horizontal planes with a custom GLSL shader that evaluates
 * dual-octave Simplex noise dynamically over world coordinates.
 * Implements THREE.FogExp2 inside the scene to provide realistic exponential
 * distance-based atmospheric scattering.
 * ============================================================================
 */

// --- 1. SHADER DEFINITION ---

const FogMistShader = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    varying vec3 vWorldPosition;

    void main() {
      vUv = uv;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform float uIntensity;
    uniform vec3 uFogColor;
    
    varying vec2 vUv;
    varying vec3 vWorldPosition;

    // Simplex 2D noise implementation
    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439,
               -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx) ;
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0) )
      + i.x + vec3(0.0, i1.x, 1.0) );
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
        dot(x12.zw,x12.zw)), 0.0);
      m = m*m ;
      m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0 ;
      vec3 h = abs(x) - 0.5 ;
      vec3 a0 = x - floor(x + 0.5);
      vec3 g = a0*vec3(x0.x,x12.x,x12.z) + h*vec3(x0.y,x12.y,x12.w);
      vec3 idx = 130.0 * vec3(dot(m, g));
      return idx.x;
    }

    void main() {
      // Create layered, slow-drifting mist patterns using dual-octave simplex noise
      vec2 noiseCoord1 = vWorldPosition.xz * 0.004 + vec2(uTime * 0.012, uTime * 0.006);
      vec2 noiseCoord2 = vWorldPosition.xz * 0.012 - vec2(uTime * 0.008, uTime * 0.016);
      
      float n1 = snoise(noiseCoord1) * 0.5 + 0.5;
      float n2 = snoise(noiseCoord2) * 0.5 + 0.5;
      
      // Combine octaves for dynamic, billowy fog structures
      float combinedNoise = mix(n1, n2, 0.35);
      
      // Radial fade out at the city edges to prevent hard clipping at the boundaries
      float dist = length(vWorldPosition.xz);
      float edgeFade = smoothstep(1100.0, 750.0, dist);
      
      // Vertical fade based on the current height layer to simulate ground density
      float heightFade = smoothstep(30.0, 2.0, vWorldPosition.y);
      
      // Calculate procedural alpha density
      float density = combinedNoise * edgeFade * heightFade * uIntensity * 0.28;
      
      // Add a subtle blue-gray color dispersion in shadows
      vec3 mistColor = mix(uFogColor, uFogColor * 1.15 + vec3(0.02, 0.04, 0.06), combinedNoise * 0.2);

      gl_FragColor = vec4(mistColor, density);
    }
  `
};

// --- 2. COMPONENT IMPLEMENTATION ---

export interface FogMistWeatherProps {
  intensity?: number;
  color?: string;
  density?: number;
}

export const FogMistWeather = ({
  intensity = 1.0,
  color = "#0a1428",
  density = 0.015,
}: FogMistWeatherProps) => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Define 5 distinct low-lying height layers
  const heights = useMemo(() => [4, 9, 14, 19, 24], []);

  // Use useMemo for uniforms to comply with react-hooks/refs
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uIntensity: { value: intensity },
    uFogColor: { value: new THREE.Color(color) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // Sync uniforms on prop updates inside useEffect (highly reactive and standard)
  useEffect(() => {
    uniforms.uIntensity.value = intensity;
    uniforms.uFogColor.value.set(color);
  }, [intensity, color, uniforms]);

  // Update elapsed time for GPU noise animation inside useFrame
  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();
    uniforms.uTime.value = elapsed;

    // Subtly sway the layers horizontally to simulate soft winds
    if (groupRef.current) {
      groupRef.current.position.x = Math.sin(elapsed * 0.05) * 8;
      groupRef.current.position.z = Math.cos(elapsed * 0.03) * 6;
    }
  });

  return (
    <group name="subsystem-fog-mist-weather">
      {/* Dynamic volumetric ground layers */}
      <group ref={groupRef}>
        {heights.map((y, idx) => (
          <mesh
            key={idx}
            position={[0, y, 0]}
            rotation={[-Math.PI / 2, 0, (idx * Math.PI) / 4]}
          >
            <planeGeometry args={[2200, 2200, 4, 4]} />
            <shaderMaterial
              vertexShader={FogMistShader.vertexShader}
              fragmentShader={FogMistShader.fragmentShader}
              uniforms={uniforms}
              transparent
              depthWrite={false}
              blending={THREE.NormalBlending}
            />
          </mesh>
        ))}
      </group>

      {/* R3F Dynamic FogExp2 Controller */}
      <fogExp2 attach="fog" args={[color, density * intensity]} />
    </group>
  );
};

export default FogMistWeather;
