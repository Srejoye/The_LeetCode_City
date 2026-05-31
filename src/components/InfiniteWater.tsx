"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface Props {
  waterColor: string;
  waterEmissive: string;
}

const vertexShader = `
  uniform float uTime;
  varying vec3 vWorldPosition;
  varying float vHeight;

  void main() {
    vec3 pos = position;

    // Gerstner-like wave displacement
    float wave1 = sin(pos.x * 0.008 + pos.z * 0.012 + uTime * 0.6) * 3.0;
    float wave2 = sin(pos.x * 0.015 - pos.z * 0.010 + uTime * 0.8) * 2.0;
    float wave3 = sin(pos.x * 0.005 + pos.z * 0.020 + uTime * 1.2) * 1.5;
    float wave4 = sin(pos.x * 0.025 + pos.z * 0.006 + uTime * 0.4) * 1.0;
    float combined = wave1 + wave2 + wave3 + wave4;

    pos.y += combined * 0.4;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;
    vHeight = combined * 0.4;

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = `
  uniform vec3 uWaterColor;
  uniform vec3 uWaterEmissive;
  uniform vec3 uCameraPos;
  varying vec3 vWorldPosition;
  varying float vHeight;

  void main() {
    vec3 viewDir = normalize(uCameraPos - vWorldPosition);

    // Fresnel effect
    float fresnel = pow(1.0 - abs(viewDir.y), 3.0);

    // Height-based color blending
    float heightNorm = clamp(vHeight / 4.0 + 0.5, 0.0, 1.0);
    vec3 color = mix(uWaterColor, uWaterEmissive, heightNorm * 0.6 + 0.2);

    // Fake reflection / specular
    float spec = pow(max(0.0, viewDir.y), 8.0) * 0.3;
    color += vec3(0.3, 0.4, 0.6) * spec;

    // Foam at wave peaks
    float foam = smoothstep(0.7, 1.0, heightNorm) * 0.15;
    color += vec3(0.7, 0.8, 0.9) * foam;

    // Subtle grid pattern for depth illusion
    float gridX = sin(vWorldPosition.x * 0.04) * 0.5 + 0.5;
    float gridZ = sin(vWorldPosition.z * 0.04) * 0.5 + 0.5;
    float gridPattern = (gridX + gridZ) * 0.25;
    color += gridPattern * 0.02;

    // Fresnel edge glow
    color += vec3(0.2, 0.3, 0.5) * fresnel * 0.15;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export default function InfiniteWater({ waterColor, waterEmissive }: Props) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const camVec = useRef(new THREE.Vector3());

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWaterColor: { value: new THREE.Color(waterColor) },
      uWaterEmissive: { value: new THREE.Color(waterEmissive) },
      uCameraPos: { value: new THREE.Vector3() },
    }),
    []
  );

  // Keep theme colors in sync
  useMemo(() => {
    if (matRef.current) {
      matRef.current.uniforms.uWaterColor.value.set(waterColor);
      matRef.current.uniforms.uWaterEmissive.value.set(waterEmissive);
    }
  }, [waterColor, waterEmissive]);

  useFrame(({ clock, camera }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.elapsedTime;
      matRef.current.uniforms.uCameraPos.value.copy(camera.position);
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]}>
      <planeGeometry args={[80000, 80000, 128, 128]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent={false}
        side={THREE.DoubleSide}
        fog={true}
      />
    </mesh>
  );
}
