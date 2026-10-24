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

// Held or carried items only. Everything else (body parts, clothing, effects)
// stays on the character. Matched against the mesh name's suffix (after the
// last dot) so bone names like `weapon_hand_R` never trigger a false positive.
// Only hero-specific props are included — shared body-part suffixes like "gun"
// are excluded to avoid false positives on heroes where "gun" is part of the body.
const PROP_SUFFIXES = new Set([
  "gun_model",
  "sword_model",
  "chrono_gun_model",
  "haze_gun_l",
  "haze_gun_r",
  "magician_wand",
  "necro_weapon_model",
  "nurse_weapon_model",
  "ratking_weapon_model",
  "primary_weapon_only",
  "primary_weapon_drum_only",
  "unicorn_baton_a",
  "yamato_weapon_longhilt",
  "yamato_weapon_shortsword",
  "yamato_weapon_beltscabbard",
  "archer_bow_model",
  "archer_clip_inbow_model",
  "book_model",
  "flask_on_hip",
  "wraith_handcards_model",
  "briefcase",
  "urn",
  "umbrella",
  "cat_v2",
]);

function bakeSkinnedMesh(src: SkinnedMesh, THREE: typeof import("three"), root: Object3D): Object3D {
  root.updateMatrixWorld(true);
  src.skeleton.update();
  // Ensure inverse bind matrices are current after reparenting
  src.skeleton.calculateInverses();

  const geo = src.geometry;
  const pos = geo.getAttribute("position");
  const nrm = geo.getAttribute("normal");
  const uv = geo.getAttribute("uv");

  const newPos = new Float32Array(pos.count * 3);
  const newNrm = nrm ? new Float32Array(nrm.count * 3) : null;

  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    src.applyBoneTransform(i, v);
    newPos[i * 3] = v.x;
    newPos[i * 3 + 1] = v.y;
    newPos[i * 3 + 2] = v.z;

    if (nrm && newNrm) {
      const n = new THREE.Vector3();
      n.fromBufferAttribute(nrm, i);
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
  // Store the suffix for reliable matching
  mesh.userData.propSuffix = src.name.includes(".") ? src.name.split(".").pop()! : src.name;
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
        const dbg0 = document.createElement("div");
        dbg0.style.cssText = "position:absolute;top:4px;left:4px;font-size:10px;color:#fff;background:rgba(0,0,0,0.7);padding:4px 6px;border-radius:4px;z-index:10;";
        dbg0.textContent = "loading...";
        container.appendChild(dbg0);

        const THREE = await import("three") as typeof import("three");
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        const { MeshoptDecoder } = await import("three/examples/jsm/libs/meshopt_decoder.module.js");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
        const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");

        if (cancelled) return;

        dbg0.textContent = "three loaded";

        const width = container.clientWidth || 400;
        const height = container.clientHeight || 480;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        container.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(38, width / height, 0.01, 100);
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
        const allMeshNames: string[] = [];
        root.traverse((obj: Object3D) => {
          const mesh = obj as SkinnedMesh & { isMesh?: boolean; name?: string };
          if (mesh.isMesh && mesh.name) {
            allMeshNames.push(mesh.name);
            const lower = mesh.name.toLowerCase();
            // Check if any prop suffix matches
            const matchedSuffix = [...PROP_SUFFIXES].find((suffix) => lower.endsWith(suffix));
            if (matchedSuffix) {
              propMeshes.push(mesh);
            }
          }
        });

        // Debug removed

        // Compute character bbox (excluding props) for framing and placement.
        propMeshes.forEach((m) => (m.visible = false));
        const charBox = new THREE.Box3().setFromObject(root);
        const charSize = charBox.getSize(new THREE.Vector3());
        const charCenter = charBox.getCenter(new THREE.Vector3());
        propMeshes.forEach((m) => (m.visible = true));

        // Remove props from the scene graph and re-add as baked, repositioned plain meshes.
        const propGroup = new THREE.Group();
        scene.add(propGroup);

        const sideX = charSize.x / 2 + 0.7;
        const headY = charBox.max.y - charSize.y * 0.15;
        const bodyY = charCenter.y;

        propMeshes.forEach((prop, i) => {
          const baked = bakeSkinnedMesh(prop, THREE, root);
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

        // Frame the camera on character + props (height-based, not width-based).
        const allBox = new THREE.Box3().setFromObject(scene);
        const size = allBox.getSize(new THREE.Vector3());
        const center = allBox.getCenter(new THREE.Vector3());
        const fov = camera.fov * (Math.PI / 180);
        const aspect = width / height;
        const distH = (size.y / 2) / Math.tan(fov / 2);
        const distW = (size.x / 2) / (Math.tan(fov / 2) * aspect);
        const cameraZ = Math.max(distH, distW) * 1.08;
        camera.position.set(center.x, center.y, center.z + cameraZ);
        camera.lookAt(center);
        camera.near = Math.max(0.01, Math.max(size.x, size.y, size.z) / 100);
        camera.far = Math.max(size.x, size.y, size.z) * 10;
        camera.updateProjectionMatrix();

        // Home camera state for the zoom-to-POI animation.
        const homeTarget = center.clone();
        const homeDistance = cameraZ;
        const closeDistance = Math.max(size.y * 0.35, 1.2);
        const focusTarget = new THREE.Vector3().copy(homeTarget);
        const focusDistance = { value: homeDistance };
        const targetGoal = homeTarget.clone();
        let distanceGoal = homeDistance;
        let activeAnchorPos: Vector3 | null = null;

        // Map anchor names -> world positions (bones, not props).
        const anchorMap = new Map<string, Vector3>();
        root.traverse((obj: Object3D) => {
          if (obj.name && pois.some((p) => p.anchor === obj.name || p.anchor === `bone:${obj.name}`)) {
            const v = new THREE.Vector3();
            obj.getWorldPosition(v);
            anchorMap.set(obj.name, v);
          }
        });

        // Map prop-based POI anchors to the baked prop's actual center position.
        pois.forEach((p) => {
          if (p.anchor.startsWith("prop:")) {
            const suffix = p.anchor.slice(5);
            const bakedMesh = propGroup.children.find((c) => (c.name ?? "").toLowerCase().endsWith(suffix.toLowerCase()));
            if (bakedMesh) {
              const pBox = new THREE.Box3().setFromObject(bakedMesh);
              const pCenter = pBox.getCenter(new THREE.Vector3());
              anchorMap.set(p.anchor, pCenter);
            }
          }
        });

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.target.copy(homeTarget);
        controls.enablePan = false;
        controls.minDistance = Math.max(size.y * 0.25, 0.8);
        controls.maxDistance = Math.max(size.x, size.y, size.z) * 4;
        controls.autoRotate = false;

        let raf = 0;
        const tmp = new THREE.Vector3();
        let frameCount = 0;
        const tick = () => {
          if (cancelled) return;
          frameCount++;

          // Smoothly steer toward the active POI (or home) on click.
          const goalPos = activeAnchorPos ? activeAnchorPos : homeTarget;
          const goalDist = activeAnchorPos ? closeDistance : homeDistance;
          targetGoal.lerp(goalPos, 0.09);
          distanceGoal += (goalDist - distanceGoal) * 0.09;

          const dir = camera.position.clone().sub(controls.target);
          const curDist = dir.length();
          if (curDist > 0.001) dir.normalize();
          else dir.set(0, 0, 1);

          controls.target.lerp(targetGoal, 0.09);
          const newDist = THREE.MathUtils.lerp(curDist, distanceGoal, 0.09);
          camera.position.copy(controls.target).addScaledVector(dir, newDist);
          controls.update();

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

          renderer.render(scene, camera);
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

        // Expose a way to drive the focus from outside (click on a POI).
        // We stash the goal on the container so the parent can update it via props.
        (container as { __setFocus?: (anchor: string | null) => void }).__setFocus = (anchor: string | null) => {
          if (anchor) {
            const w = anchorMap.get(anchor);
            if (w) activeAnchorPos = w;
          } else {
            activeAnchorPos = null;
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

  // Drive the focus goal from the activePoi prop.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const setter = (container as { __setFocus?: (anchor: string | null) => void }).__setFocus;
    if (setter) setter(activePoi);
  }, [activePoi]);

  const activePoiData = pois.find((p) => p.anchor === activePoi);
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