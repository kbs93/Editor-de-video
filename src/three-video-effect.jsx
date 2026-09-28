import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uTexture;
  uniform vec2 uResolution;
  uniform float uTime;

  // Tela Verde / Chroma Key
  uniform int uGreenScreenEnabled;
  uniform float uGreenScreenLimit;
  uniform int uGreenScreenColorType;

  // Remoção de Preto / Branco
  uniform int uRemoveColorEnabled;
  uniform float uRemoveColorLimit;
  uniform int uRemoveColorType;

  // VHS
  uniform int uVhsEnabled;
  uniform float uVhsGrain;
  uniform float uVhsIntensity;

  // Difusão
  uniform int uDiffusionEnabled;
  uniform float uDiffusionForce;

  varying vec2 vUv;

  float random(vec2 p) {
    return fract(sin(dot(p.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  void main() {
    vec2 uv = vUv;
    vec4 color;

    // 1. Efeito VHS
    if (uVhsEnabled == 1) {
      float shift = 0.003 * uVhsIntensity;
      float r = texture2D(uTexture, uv + vec2(shift, 0.0)).r;
      float g = texture2D(uTexture, uv).g;
      float b = texture2D(uTexture, uv - vec2(shift, 0.0)).b;
      float a = texture2D(uTexture, uv).a;
      color = vec4(r, g, b, a);

      float scanline = sin(uv.y * uResolution.y * 1.5) * 0.08 * uVhsIntensity;
      color.rgb -= scanline;

      float noise = (random(uv + mod(uTime, 10.0)) - 0.5) * (uVhsGrain * 0.4);
      color.rgb += noise;
    } else {
      color = texture2D(uTexture, uv);
    }

    // 2. Tela Verde (Chroma Key)
    if (uGreenScreenEnabled == 1) {
      vec3 targetColor = (uGreenScreenColorType == 0) ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
      float dist = distance(color.rgb, targetColor);
      float threshold = uGreenScreenLimit;

      if (dist < threshold) {
        discard;
      } else if (dist < threshold + 0.08) {
        color.a *= smoothstep(threshold, threshold + 0.08, dist);
      }
    }

    // 3. Remoção de Preto / Branco
    if (uRemoveColorEnabled == 1) {
      float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      if (uRemoveColorType == 0) {
        if (luminance < uRemoveColorLimit) discard;
      } else {
        if (luminance > (1.0 - uRemoveColorLimit)) discard;
      }
    }

    // 4. Difusão
    if (uDiffusionEnabled == 1) {
      color.rgb = mix(color.rgb, vec3(1.0) - (vec3(1.0) - color.rgb) * (vec3(1.0) - color.rgb), uDiffusionForce * 0.35);
    }

    gl_FragColor = color;
  }
`;

export function ThreeVideoEffect({ videoElement, width, height, effects = {} }) {
  const containerRef = useRef(null);
  const uniformsRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const textureRef = useRef(null);
  const frame = useCurrentFrame();

  useEffect(() => {
    if (!containerRef.current || !videoElement) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });

    renderer.setSize(width, height);
    renderer.setPixelRatio(1);
    containerRef.current.appendChild(renderer.domElement);

    const texture = new THREE.VideoTexture(videoElement);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const uniforms = {
      uTexture: { value: texture },
      uResolution: { value: new THREE.Vector2(width, height) },
      uTime: { value: 0 },
      uGreenScreenEnabled: { value: effects.greenScreen?.enabled ? 1 : 0 },
      uGreenScreenLimit: { value: (effects.greenScreen?.limit ?? 50) / 100 },
      uGreenScreenColorType: { value: effects.greenScreen?.color === "Azul" ? 1 : 0 },
      uRemoveColorEnabled: { value: effects.removeColor?.enabled ? 1 : 0 },
      uRemoveColorLimit: { value: (effects.removeColor?.limit ?? 50) / 100 },
      uRemoveColorType: { value: effects.removeColor?.color === "Branco" ? 1 : 0 },
      uVhsEnabled: { value: effects.vhs?.enabled ? 1 : 0 },
      uVhsGrain: { value: (effects.vhs?.grain ?? 60) / 100 },
      uVhsIntensity: { value: (effects.vhs?.intensity ?? 40) / 100 },
      uDiffusionEnabled: { value: effects.diffusion?.enabled ? 1 : 0 },
      uDiffusionForce: { value: (effects.diffusion?.force ?? 50) / 100 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    uniformsRef.current = uniforms;
    textureRef.current = texture;

    return () => {
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [videoElement, width, height]);

  // Atualização em sincronia com cada frame do Remotion
  useEffect(() => {
    if (uniformsRef.current && rendererRef.current && sceneRef.current && cameraRef.current) {
      uniformsRef.current.uTime.value = frame / 30;
      uniformsRef.current.uGreenScreenEnabled.value = effects.greenScreen?.enabled ? 1 : 0;
      uniformsRef.current.uGreenScreenLimit.value = (effects.greenScreen?.limit ?? 50) / 100;
      uniformsRef.current.uGreenScreenColorType.value = effects.greenScreen?.color === "Azul" ? 1 : 0;
      uniformsRef.current.uRemoveColorEnabled.value = effects.removeColor?.enabled ? 1 : 0;
      uniformsRef.current.uRemoveColorLimit.value = (effects.removeColor?.limit ?? 50) / 100;
      uniformsRef.current.uRemoveColorType.value = effects.removeColor?.color === "Branco" ? 1 : 0;
      uniformsRef.current.uVhsEnabled.value = effects.vhs?.enabled ? 1 : 0;
      uniformsRef.current.uVhsGrain.value = (effects.vhs?.grain ?? 60) / 100;
      uniformsRef.current.uVhsIntensity.value = (effects.vhs?.intensity ?? 40) / 100;
      uniformsRef.current.uDiffusionEnabled.value = effects.diffusion?.enabled ? 1 : 0;
      uniformsRef.current.uDiffusionForce.value = (effects.diffusion?.force ?? 50) / 100;

      if (textureRef.current) textureRef.current.needsUpdate = true;
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, [frame, effects]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: "none",
      }}
    />
  );
}