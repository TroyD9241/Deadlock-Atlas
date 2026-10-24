"use client";

import type { Box3, Material, Object3D, Vector3 } from "three";

import { useEffect, useRef, useState } from "react";

export type ModelPoi = {
  anchor: string;
  label: string;
  body: string;
};

export type ModelViewerProps = {
  modelUrl: string;
  accent: string;
  name: string;
  fallbackImage: string | null;
  pois?: ModelPoi[];
};

type Marker = { anchor: string; x: number; y: number; visible: boolean };

export function ModelViewer({ modelUrl, accent, name, fallbackImage, pois = [] }: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [progress, setProgress] = useState(0);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [activePoi, setActivePoi] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        const THREE = await import("three") as typeof import("three");
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        const { MeshoptDecoder } = await import("three/examples/jsm/libs/meshopt_decoder.module.js");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
        const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");

        if (cancelled) return;

        const width = container.clientWidth || 400;
        const height = container.clientHeight || 400;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        container.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100);
        camera.position.set(0, 1.6, 4);

        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;
        pmrem.dispose();

        const key = new THREE.DirectionalLight(0xffffff, 1.2);
        key.position.set(2, 3, 2);
        scene.add(key);
        const fill = new THREE.DirectionalLight(accent, 0.4);
        fill.position.set(-2, 1, -1);
        scene.add(fill);
        const amb = new THREE.AmbientLight(0xffffff, 0.3);
        scene.add(amb);

        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);

        const gltf = await new Promise<{ scene: Object3D; animations: { name: string }[] }>((resolve, reject) => {
          loader.load(
            modelUrl,
            (g) => resolve(g as { scene: Object3D; animations: { name: string }[] }),
            (e) => setProgress(Math.round((e.loaded / (e.total || 1)) * 100)),
            (err) => reject(err),
          );
        });

        if (cancelled) {
          renderer.dispose();
          return;
        }

        const root = gltf.scene;

        // Hide weapon and prop meshes — show only the character body.
        const PROP_KEYWORDS = ["gun", "book", "flask", "cards", "baton", "weapon", "reliquary", "muzzle"];
        root.traverse((obj: Object3D) => {
          const mesh = obj as Object3D & { isMesh?: boolean; name?: string };
          if (mesh.isMesh && mesh.name) {
            const lower = mesh.name.toLowerCase();
            if (PROP_KEYWORDS.some((kw) => lower.includes(kw))) {
              mesh.visible = false;
            }
          }
        });

        scene.add(root);

        // Frame the camera on the model.
        const box: Box3 = new THREE.Box3().setFromObject(root);
        const size: Vector3 = box.getSize(new THREE.Vector3());
        const center: Vector3 = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        const cameraZ = (maxDim / 2) / Math.tan(fov / 2) * 1.4;
        camera.position.set(center.x, center.y, center.z + cameraZ);
        camera.lookAt(center);
        camera.near = Math.max(0.01, maxDim / 100);
        camera.far = maxDim * 10;
        camera.updateProjectionMatrix();

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.target.copy(center);
        controls.enablePan = false;
        controls.minDistance = maxDim * 0.8;
        controls.maxDistance = maxDim * 3;
        controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        controls.autoRotateSpeed = 0.6;

        // Map anchor names -> world positions.
        const anchorMap = new Map<string, Vector3>();
        root.traverse((obj: Object3D) => {
          if (obj.name && pois.some((p) => p.anchor === obj.name)) {
            const v = new THREE.Vector3();
            obj.getWorldPosition(v);
            anchorMap.set(obj.name, v);
          }
        });

        let raf = 0;
        const tmp = new THREE.Vector3();
        const tick = () => {
          if (cancelled) return;
          controls.update();
          renderer.render(scene, camera);

          // Project anchors to screen space.
          const rect = renderer.domElement.getBoundingClientRect();
          const next: Marker[] = pois.map((p) => {
            const w = anchorMap.get(p.anchor);
            if (!w) return { anchor: p.anchor, x: 0, y: 0, visible: false };
            tmp.copy(w).project(camera);
            const x = (tmp.x * 0.5 + 0.5) * rect.width;
            const y = (-tmp.y * 0.5 + 0.5) * rect.height;
            const visible = tmp.z >= -1 && tmp.z <= 1;
            return { anchor: p.anchor, x, y, visible };
          });
          setMarkers(next);

          raf = requestAnimationFrame(tick);
        };
        tick();

        setStatus("ready");

        const onResize = () => {
          const w = container.clientWidth;
          const h = container.clientHeight;
          if (!w || !h) return;
          renderer.setSize(w, h);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        };
        const ro = new ResizeObserver(onResize);
        ro.observe(container);

        cleanup = () => {
          cancelAnimationFrame(raf);
          ro.disconnect();
          controls.dispose();
          renderer.dispose();
          scene.traverse((obj: Object3D) => {
            const o = obj as Object3D & { geometry?: { dispose: () => void }; material?: Material | Material[] };
            if (o.geometry) o.geometry.dispose();
            if (o.material) {
              if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
              else o.material.dispose();
            }
          });
          if (renderer.domElement.parentNode === container) {
            container.removeChild(renderer.domElement);
          }
        };
      } catch (e) {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [modelUrl, accent, pois]);

  const activePoiData = pois.find((p) => p.anchor === activePoi);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: "100%",
          height: 420,
          borderRadius: 14,
          overflow: "hidden",
          background: "#0b0e17",
          border: "1px solid var(--line)",
        }}
      >
        {status === "loading" ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: "var(--muted)",
              fontSize: 12,
            }}
          >
            {fallbackImage ? (
              <img
                src={fallbackImage}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "contain", opacity: 0.4 }}
              />
            ) : null}
            <div style={{ position: "absolute", bottom: 12, left: 12, fontSize: 11 }}>
              Loading model… {progress}%
            </div>
          </div>
        ) : null}
        {status === "error" ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: "var(--muted)",
              fontSize: 12,
            }}
          >
            {fallbackImage ? (
              <img
                src={fallbackImage}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "contain", opacity: 0.6 }}
              />
            ) : null}
            <div style={{ position: "absolute", bottom: 12, left: 12, fontSize: 11 }}>
              3D model unavailable.
            </div>
          </div>
        ) : null}
        {status === "ready"
          ? markers
              .filter((m) => m.visible)
              .map((m) => {
                const poi = pois.find((p) => p.anchor === m.anchor);
                if (!poi) return null;
                return (
                  <button
                    key={m.anchor}
                    type="button"
                    onClick={() => setActivePoi((cur) => (cur === m.anchor ? null : m.anchor))}
                    aria-label={poi.label}
                    aria-expanded={activePoi === m.anchor}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                    onMouseLeave={(e) => { if (activePoi !== m.anchor) (e.currentTarget as HTMLButtonElement).style.opacity = "0.25"; }}
                    style={{
                      position: "absolute",
                      left: m.x,
                      top: m.y,
                      transform: "translate(-50%, -50%)",
                      width: 18,
                      height: 18,
                      borderRadius: 999,
                      border: "2px solid var(--on-accent)",
                      background: "var(--accent)",
                      cursor: "pointer",
                      boxShadow: "0 0 0 4px color-mix(in srgb, var(--accent) 25%, transparent)",
                      zIndex: 5,
                      opacity: 0.25,
                    }}
                  />
                );
              })
          : null}
      </div>

      {activePoiData ? (
        <div className="panel" style={{ padding: 14 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 13, marginBottom: 6, color: "var(--accent)" }}>
            {activePoiData.label}
          </div>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: "#b5b7c7", fontFamily: "var(--font-mono)" }}>
            {activePoiData.body}
          </p>
        </div>
      ) : null}

      {pois.length > 0 ? (
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.17em", color: "var(--accent)", fontWeight: 850, fontFamily: "var(--font-display)" }}>
            POINTS OF INTEREST
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
            {pois.map((p) => (
              <li key={p.anchor}>
                <button
                  type="button"
                  onClick={() => setActivePoi((cur) => (cur === p.anchor ? null : p.anchor))}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: activePoi === p.anchor ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "#ffffff05",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    padding: "8px 10px",
                    color: "#c7c7d5",
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-display)", color: "var(--accent)", marginRight: 8 }}>
                    {p.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}