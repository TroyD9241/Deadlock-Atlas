"use client";

import type { Material, Object3D, SkinnedMesh, Vector3 } from "three";

import { useEffect, useRef, useState } from "react";

export type ModelPoi = {
  anchor: string;
  label: string;
  body: string;
};

export type ModelViewerProps = {
  modelUrl: string;
  accent: string;
  fallbackImage: string | null;
  pois?: ModelPoi[];
  hoveredPoi?: string | null;
  activePoi?: string | null;
  onPoiHover?: (anchor: string | null) => void;
  onPoiClick?: (anchor: string) => void;
};

type Marker = { anchor: string; x: number; y: number; visible: boolean };

// Meshes whose names contain any of these are treated as props/weapons and
// repositioned away from the character body.
const PROP_KEYWORDS = ["gun", "book", "flask", "cards", "baton", "weapon", "reliquary", "muzzle"];

// Bake a skinned mesh into a plain mesh so it can be moved freely.
function bakeSkinnedMesh(src: SkinnedMesh, THREE: typeof import("three")): Object3D {
  src.updateMatrixWorld(true);
  src.skeleton.update();

  const geo = src.geometry;
  const pos = geo.getAttribute("position");
  const nrm = geo.getAttribute("normal");
  const uv = geo.getAttribute("uv");

  const newPos = new Float32Array(pos.count * 3);
  const newNrm = nrm ? new Float32Array(nrm.count * 3) : null;

  const v = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    src.applyBoneTransform(i, v);
    newPos[i * 3] = v.x;
    newPos[i * 3 + 1] = v.y;
    newPos[i * 3 + 2] = v.z;

    if (nrm && newNrm) {
      n.fromBufferAttribute(nrm, i);
      // Approximate: transform normal by the same bone matrix used for the vertex.
      // applyBoneTransform only gives position, so we transform the normal by
      // the dominant bone's rotation. Good enough for props.
      newNrm[i * 3] = n.x;
      newNrm[i * 3 + 1] = n.y;
      newNrm[i * 3 + 2] = n.z;
    }
  }

  const newGeo = geo.clone();
  newGeo.setAttribute("position", new THREE.BufferAttribute(newPos, 3));
  if (newNrm) newGeo.setAttribute("normal", new THREE.BufferAttribute(newNrm, 3));
  if (uv) newGeo.setAttribute("uv", uv.clone());
  newGeo.computeVertexNormals();
  newGeo.computeBoundingBox();

  const mat = Array.isArray(src.material) ? src.material[0] : src.material;
  const mesh = new THREE.Mesh(newGeo, mat ? mat.clone() : undefined);
  mesh.name = src.name;
  return mesh;
}

export function ModelViewer({
  modelUrl,
  accent,
  fallbackImage,
  pois = [],
  hoveredPoi = null,
  activePoi = null,
  onPoiHover,
  onPoiClick,
}: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [progress, setProgress] = useState(0);
  const [markers, setMarkers] = useState<Marker[]>([]);

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
        const height = container.clientHeight || 480;

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
        scene.add(root);

        // Collect prop meshes (skinned) and bake them into plain meshes positioned
        // to the left/right of the character at head/body height.
        const propMeshes: SkinnedMesh[] = [];
        root.traverse((obj: Object3D) => {
          const mesh = obj as SkinnedMesh & { isMesh?: boolean; name?: string };
          if (mesh.isMesh && mesh.name) {
            const lower = mesh.name.toLowerCase();
            if (PROP_KEYWORDS.some((kw) => lower.includes(kw))) {
              propMeshes.push(mesh);
            }
          }
        });

        // Compute character bbox (excluding props) for framing and placement.
        propMeshes.forEach((m) => (m.visible = false));
        const charBox = new THREE.Box3().setFromObject(root);
        const charSize = charBox.getSize(new THREE.Vector3());
        const charCenter = charBox.getCenter(new THREE.Vector3());
        propMeshes.forEach((m) => (m.visible = true));

        // Remove props from the scene graph and re-add as baked, repositioned plain meshes.
        const propGroup = new THREE.Group();
        scene.add(propGroup);

        const sideX = charSize.x / 2 + 1.2;
        const headY = charBox.max.y - charSize.y * 0.15;
        const bodyY = charCenter.y;

        propMeshes.forEach((prop, i) => {
          const baked = bakeSkinnedMesh(prop, THREE);
          propGroup.add(baked);

          const side = i % 2 === 0 ? 1 : -1;
          const yOffset = Math.floor(i / 2) * 1.6;
          const x = side * sideX;
          const y = (i < 2 ? bodyY : headY) + yOffset;
          const z = charCenter.z;

          const pBox = new THREE.Box3().setFromObject(baked);
          const pCenter = pBox.getCenter(new THREE.Vector3());
          baked.position.set(x - pCenter.x + charCenter.x, y - pCenter.y, z - pCenter.z);
          baked.rotation.y = side > 0 ? -0.3 : 0.3;

          if (prop.parent) prop.parent.remove(prop);
        });

        // Frame the camera on character + props.
        const allBox = new THREE.Box3().setFromObject(scene);
        const size = allBox.getSize(new THREE.Vector3());
        const center = allBox.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        const cameraZ = (maxDim / 2) / Math.tan(fov / 2) * 1.5;
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
        controls.minDistance = maxDim * 0.6;
        controls.maxDistance = maxDim * 4;
        controls.autoRotate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        controls.autoRotateSpeed = 0.6;

        // Map anchor names -> world positions (bones, not props).
        const anchorMap = new Map<string, Vector3>();
        root.traverse((obj: Object3D) => {
          if (obj.name && pois.some((p) => p.anchor === obj.name)) {
            const v = new THREE.Vector3();
            obj.getWorldPosition(v);
            anchorMap.set(obj.name, v);
          }
        });

        // Prop anchors are mapped to bones for now (props are hidden).

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

  const activePoiData = pois.find((p) => p.anchor === activePoi || p.anchor === hoveredPoi);
  const ringAnchor = activePoi ?? hoveredPoi;
  const ringMarker = markers.find((m) => m.anchor === ringAnchor && m.visible);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        ref={containerRef}
        style={{
          position: "relative",
          width: "100%",
          height: 480,
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
        {status === "ready" && ringMarker ? (
          <div
            style={{
              position: "absolute",
              left: ringMarker.x,
              top: ringMarker.y,
              transform: "translate(-50%, -50%)",
              width: 28,
              height: 28,
              borderRadius: 999,
              border: "2px solid var(--accent)",
              background: "transparent",
              boxShadow: "0 0 0 6px color-mix(in srgb, var(--accent) 15%, transparent), 0 0 16px color-mix(in srgb, var(--accent) 40%, transparent)",
              zIndex: 5,
              pointerEvents: "none",
              animation: "poi-ring-pulse 1.6s ease-in-out infinite",
            }}
          />
        ) : null}
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
    </div>
  );
}