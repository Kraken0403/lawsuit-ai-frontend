import { useEffect, useRef } from "react";
import * as THREE from "three";

type OrbCanvasProps = {
  size?: number;
};

type PointMeta = {
  base: THREE.Vector3;
  normal: THREE.Vector3;
  offset: number;
  speed: number;
  amp: number;
};

function generateSpherePoints(
  count: number,
  radius: number
): {
  positions: Float32Array;
  colors: Float32Array;
  meta: PointMeta[];
} {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const meta: PointMeta[] = [];

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));

  const deep = new THREE.Color("#0b3a6e");
  const mid = new THREE.Color("#2f7dff");
  const light = new THREE.Color("#b7e7ff");

  for (let i = 0; i < count; i += 1) {
    const t = i / Math.max(count - 1, 1);
    const y = 1 - t * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;

    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;

    const dir = new THREE.Vector3(x, y, z).normalize();
    const baseRadius = radius + (Math.random() - 0.5) * 0.06;
    const base = dir.clone().multiplyScalar(baseRadius);

    const i3 = i * 3;
    positions[i3] = base.x;
    positions[i3 + 1] = base.y;
    positions[i3 + 2] = base.z;

    const mixA = Math.random();
    const mixB = Math.random() * 0.75;
    const color = deep.clone().lerp(mid, mixA).lerp(light, mixB);

    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;

    meta.push({
      base,
      normal: dir,
      offset: Math.random() * Math.PI * 2,
      speed: 0.65 + Math.random() * 1.6,
      amp: 0.02 + Math.random() * 0.05,
    });
  }

  return { positions, colors, meta };
}

export default function OrbCanvas({ size = 180 }: OrbCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let width = container.clientWidth || size;
    let height = container.clientHeight || size;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0, 5.1);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);

    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.left = "0";
    renderer.domElement.style.top = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const mouse = new THREE.Vector2(0, 0);
    const mouseTarget = new THREE.Vector2(0, 0);
    let hover = 0;
    let hoverTarget = 0;

    const innerData = generateSpherePoints(1900, 1.22);
    const outerData = generateSpherePoints(950, 1.42);

    const innerGeometry = new THREE.BufferGeometry();
    innerGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(innerData.positions, 3)
    );
    innerGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(innerData.colors, 3)
    );

    const outerGeometry = new THREE.BufferGeometry();
    outerGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(outerData.positions, 3)
    );
    outerGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(outerData.colors, 3)
    );

    const innerMaterial = new THREE.PointsMaterial({
      size: 0.095,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const outerMaterial = new THREE.PointsMaterial({
      size: 0.065,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const innerPoints = new THREE.Points(innerGeometry, innerMaterial);
    const outerPoints = new THREE.Points(outerGeometry, outerMaterial);

    group.add(innerPoints);
    group.add(outerPoints);

    const coreGeometry = new THREE.SphereGeometry(0.72, 32, 32);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#2f7dff"),
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    group.add(core);

    const haloGeometry = new THREE.SphereGeometry(1.65, 32, 32);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#78d1ff"),
      transparent: true,
      opacity: 0.045,
      depthWrite: false,
      side: THREE.BackSide,
    });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    group.add(halo);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    scene.add(ambientLight);

    const clock = new THREE.Clock();

    const updateGeometryPositions = (
      geometry: THREE.BufferGeometry,
      data: { meta: PointMeta[] },
      time: number,
      mouseInfluence: THREE.Vector2,
      hoverStrength: number,
      driftScale: number,
      mousePushStrength: number
    ) => {
      const positionAttr = geometry.getAttribute(
        "position"
      ) as THREE.BufferAttribute;
      const arr = positionAttr.array as Float32Array;

      for (let i = 0; i < data.meta.length; i += 1) {
        const m = data.meta[i];

        const pulse =
          Math.sin(time * m.speed + m.offset) * m.amp +
          Math.cos(time * (m.speed * 0.7) + m.offset * 1.5) * m.amp * 0.65;

        const driftX =
          Math.sin(time * 0.72 + m.offset * 1.15 + m.normal.y * 4.2) *
          0.022 *
          driftScale;
        const driftY =
          Math.cos(time * 0.86 + m.offset * 0.92 + m.normal.z * 4.1) *
          0.022 *
          driftScale;
        const driftZ =
          Math.sin(time * 0.66 + m.offset * 1.32 + m.normal.x * 4.5) *
          0.018 *
          driftScale;

        const mouseDot =
          m.normal.x * mouseInfluence.x + m.normal.y * mouseInfluence.y;
        const focus = Math.max(0, mouseDot);
        const mousePush = focus * mousePushStrength * hoverStrength;

        const final = m.base
          .clone()
          .addScaledVector(m.normal, pulse + mousePush);

        final.x += driftX;
        final.y += driftY;
        final.z += driftZ;

        const i3 = i * 3;
        arr[i3] = final.x;
        arr[i3 + 1] = final.y;
        arr[i3 + 2] = final.z;
      }

      positionAttr.needsUpdate = true;
    };

    const handleResize = () => {
      width = container.clientWidth || size;
      height = container.clientHeight || size;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

      mouseTarget.set(x, y);
      hoverTarget = 1;
    };

    const handlePointerLeave = () => {
      mouseTarget.set(0, 0);
      hoverTarget = 0;
    };

    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("resize", handleResize);

    let rafRef = 0;

    const animate = () => {
      const elapsed = clock.getElapsedTime();

      mouse.lerp(mouseTarget, 0.085);
      hover += (hoverTarget - hover) * 0.07;

      updateGeometryPositions(
        innerGeometry,
        innerData,
        elapsed,
        mouse,
        hover,
        1,
        0.22
      );

      updateGeometryPositions(
        outerGeometry,
        outerData,
        elapsed + 0.75,
        mouse,
        hover,
        1.35,
        0.28
      );

      group.rotation.y += 0.0032;
      group.rotation.x += (mouse.y * 0.35 - group.rotation.x) * 0.07;
      group.rotation.z += (-mouse.x * 0.22 - group.rotation.z) * 0.06;

      group.position.x += (mouse.x * 0.24 - group.position.x) * 0.06;
      group.position.y += (mouse.y * 0.2 - group.position.y) * 0.06;

      const breathe = 1 + Math.sin(elapsed * 1.55) * 0.03;
      core.scale.setScalar(1 + Math.sin(elapsed * 1.9) * 0.075 + hover * 0.05);
      halo.scale.setScalar(breathe + hover * 0.08);

      coreMaterial.opacity =
        0.1 + Math.sin(elapsed * 1.7) * 0.025 + hover * 0.045;
      haloMaterial.opacity = 0.04 + hover * 0.04;

      innerMaterial.opacity = 0.95 + hover * 0.05;
      outerMaterial.opacity = 0.5 + hover * 0.08;

      renderer.render(scene, camera);
      rafRef = requestAnimationFrame(animate);
    };

    handleResize();
    animate();

    return () => {
      cancelAnimationFrame(rafRef);

      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);

      innerGeometry.dispose();
      outerGeometry.dispose();
      coreGeometry.dispose();
      haloGeometry.dispose();

      innerMaterial.dispose();
      outerMaterial.dispose();
      coreMaterial.dispose();
      haloMaterial.dispose();

      renderer.dispose();

      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [size]);

  return (
    <div
      ref={mountRef}
      className="orb-wrapper"
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "block",
        overflow: "visible",
        borderRadius: "9999px",
      }}
    />
  );
}

