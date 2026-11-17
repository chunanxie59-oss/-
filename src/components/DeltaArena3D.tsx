import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Volume2, VolumeX, Pause, RotateCcw, ArrowLeft, Crosshair } from 'lucide-react';
import {
  CombatReport,
  LoadoutConfig,
  MAP_ZONES,
  OPERATOR_ROLES,
  WEAPONS,
  computeBallistics,
} from '../types/tactical';
import {
  createEnemyOperator,
  createExtractionPad,
  createIntelCrate,
  createJerseyBarrier,
  createProceduralTextures,
  createRadarTower,
  createSandbagBunker,
  createShippingContainer,
  createViewmodelWeapon,
} from '../three/proceduralAssets';
import { soundEngine } from '../audio/soundEngine';

interface DeltaArena3DProps {
  loadout: LoadoutConfig;
  onExit: () => void;
  onMissionComplete: (report: CombatReport) => void;
}

interface ObstacleBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxY: number;
}

interface EnemyEntity {
  id: number;
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  hp: number;
  maxHp: number;
  alive: boolean;
  elite: boolean;
  homePos: THREE.Vector3;
  patrolTarget: THREE.Vector3;
  fireCooldown: number;
  burstLeft: number;
  alerted: boolean;
  walkPhase: number;
  hitFlash: number;
}

interface TracerBeam {
  mesh: THREE.Mesh;
  life: number;
}

interface ParticleBurst {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface GrenadeEntity {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  fuse: number;
}

interface IntelEntity {
  group: THREE.Group;
  beaconRing: THREE.Mesh;
  pos: THREE.Vector3;
  collected: boolean;
}

interface HudState {
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  ammo: number;
  reserve: number;
  sidearmAmmo: number;
  sidearmReserve: number;
  activeSlot: 'primary' | 'sidearm';
  grenades: number;
  reloading: boolean;
  ads: boolean;
  crouching: boolean;
  hostilesLeft: number;
  hostilesTotal: number;
  intelCollected: number;
  intelTotal: number;
  timeRemaining: number;
  nearPrompt: string | null;
  extractionProgress: number;
  extracting: boolean;
  hitmarker: 'none' | 'hit' | 'headshot' | 'kill';
  damageFlash: number;
  statusBanner: string | null;
  pointerLocked: boolean;
  paused: boolean;
  finished: CombatReport | null;
  contextLost: boolean;
}

// Module-scope reusable math helpers (zero per-frame GC)
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveVec = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _tempVec = new THREE.Vector3();
const _eyeVec = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);

export const DeltaArena3D: React.FC<DeltaArena3DProps> = ({
  loadout,
  onExit,
  onMissionComplete,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [muted, setMuted] = useState(soundEngine.isMuted());
  const [sensitivity, setSensitivity] = useState(0.0021);
  const sensitivityRef = useRef(0.0021);
  const [runSeed, setRunSeed] = useState(0);

  const mapSpec = MAP_ZONES[loadout.mapId];
  const ballistics = computeBallistics(loadout);
  const operatorSpec =
    OPERATOR_ROLES.find((r) => r.id === loadout.operatorRole) ?? OPERATOR_ROLES[0];
  const weaponSpec = WEAPONS[loadout.weaponId];

  const [hud, setHud] = useState<HudState>(() => ({
    hp: 100,
    maxHp: 100,
    armor: 75 + operatorSpec.armorBonus,
    maxArmor: 75 + operatorSpec.armorBonus,
    ammo: ballistics.magCapacity,
    reserve: ballistics.magCapacity * 4,
    sidearmAmmo: 15,
    sidearmReserve: 60,
    activeSlot: 'primary',
    grenades: 2,
    reloading: false,
    ads: false,
    crouching: false,
    hostilesLeft: mapSpec.hostileCount,
    hostilesTotal: mapSpec.hostileCount,
    intelCollected: 0,
    intelTotal: mapSpec.intelCount,
    timeRemaining: mapSpec.timeLimitSec,
    nearPrompt: null,
    extractionProgress: 0,
    extracting: false,
    hitmarker: 'none',
    damageFlash: 0,
    statusBanner: null,
    pointerLocked: false,
    paused: false,
    finished: null,
    contextLost: false,
  }));

  // Mutable ref to communicate React control triggers into WebGL loop without tearing down scene
  const actionsRef = useRef<{
    lockPointer: () => void;
    resumeGame: () => void;
    togglePause: () => void;
    forceRestart: () => void;
  }>({
    lockPointer: () => {},
    resumeGame: () => {},
    togglePause: () => {},
    forceRestart: () => {},
  });

  useEffect(() => {
    sensitivityRef.current = sensitivity;
  }, [sensitivity]);

  const toggleMute = useCallback(() => {
    const next = !soundEngine.isMuted();
    soundEngine.setMuted(next);
    setMuted(next);
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Detect software WebGL strictly via GPU renderer string
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.innerHTML = '';
    container.appendChild(canvas);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setHud((prev) => ({ ...prev, contextLost: true }));
    };
    const onContextRestored = () => {
      setHud((prev) => ({ ...prev, contextLost: false }));
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(mapSpec.skyColor);
    scene.fog = new THREE.FogExp2(mapSpec.fogColor, mapSpec.fogDensity);

    // Mandatory Studio/Environment reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const baseFov = 74;
    const camera = new THREE.PerspectiveCamera(baseFov, width / height, 0.08, 280);
    camera.rotation.order = 'YXZ';
    scene.add(camera);

    // Warm key light + Cool Hemisphere fill
    const hemiLight = new THREE.HemisphereLight(
      loadout.mapId === 'zero_dam' ? 0xbcd0e4 : 0xdbeafe,
      loadout.mapId === 'zero_dam' ? 0x2c3238 : 0x5c4c38,
      0.72
    );
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(
      loadout.mapId === 'zero_dam' ? 0xffe4c4 : 0xfff3d6,
      1.65
    );
    sunLight.position.set(36, 54, 28);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    const d = 52;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 140;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    // Procedural textures
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const textures = createProceduralTextures(maxAniso, loadout.mapId);

    // Extended natural terrain floor (never floating void)
    const groundGeo = new THREE.PlaneGeometry(280, 280);
    const groundMat = new THREE.MeshStandardMaterial({
      map: textures.terrainMap,
      roughness: 0.92,
      metalness: 0.04,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Build tactical obstacles & natural perimeter
    const obstacles: ObstacleBox[] = [];
    const environmentMeshes: THREE.Object3D[] = [ground];

    const addObstacle = (
      obj: THREE.Object3D,
      x: number,
      z: number,
      halfW: number,
      halfD: number,
      height: number,
      rotY = 0
    ) => {
      obj.position.set(x, 0, z);
      obj.rotation.y = rotY;
      scene.add(obj);
      environmentMeshes.push(obj);

      const cos = Math.abs(Math.cos(rotY));
      const sin = Math.abs(Math.sin(rotY));
      const effHalfW = halfW * cos + halfD * sin;
      const effHalfD = halfW * sin + halfD * cos;

      obstacles.push({
        minX: x - effHalfW,
        maxX: x + effHalfW,
        minZ: z - effHalfD,
        maxZ: z + effHalfD,
        maxY: height,
      });
    };

    // Natural cliff/rock outcrops around arena perimeter (45m radius)
    const rockMat = new THREE.MeshStandardMaterial({
      color: loadout.mapId === 'zero_dam' ? 0x3b4046 : 0x6b5c49,
      roughness: 0.94,
      metalness: 0.03,
    });
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const dist = 48 + (i % 3) * 4;
      const rx = Math.cos(angle) * dist;
      const rz = Math.sin(angle) * dist;
      const rw = 10 + (i % 4) * 3;
      const rh = 7 + (i % 5) * 3.5;
      const rockGroup = new THREE.Group();
      const baseRock = new THREE.Mesh(new THREE.DodecahedronGeometry(rw * 0.65, 1), rockMat);
      baseRock.scale.set(1.2, rh / (rw * 0.7), 1.0);
      baseRock.position.y = rh * 0.35;
      baseRock.castShadow = true;
      baseRock.receiveShadow = true;
      rockGroup.add(baseRock);
      scene.add(rockGroup);
      rockGroup.position.set(rx, 0, rz);
      environmentMeshes.push(rockGroup);
    }

    // Heroic architectural landmark for Zero Dam or Longbow Valley
    if (loadout.mapId === 'zero_dam') {
      const damMat = new THREE.MeshStandardMaterial({
        map: textures.concreteMap,
        roughness: 0.85,
        metalness: 0.08,
      });
      const damWall = new THREE.Mesh(new THREE.BoxGeometry(110, 24, 12), damMat);
      damWall.position.set(0, 12, -52);
      damWall.receiveShadow = true;
      scene.add(damWall);
      environmentMeshes.push(damWall);
      for (let b = -40; b <= 40; b += 16) {
        const buttress = new THREE.Mesh(new THREE.BoxGeometry(3.2, 22, 6), damMat);
        buttress.position.set(b, 11, -44.5);
        scene.add(buttress);
        environmentMeshes.push(buttress);
      }
    } else {
      const { group: radar, dish } = createRadarTower();
      radar.position.set(-22, 0, -28);
      scene.add(radar);
      environmentMeshes.push(radar);
      // Store dish animation reference
      radar.userData.dish = dish;
    }

    // Tactical cover layout
    const containerSpots: [number, number, number, boolean][] =
      loadout.mapId === 'zero_dam'
        ? [
            [-10, 14, 0, true],
            [12, 12, Math.PI / 2, false],
            [-14, -2, Math.PI / 6, false],
            [8, -6, 0, true],
            [-4, -20, Math.PI / 2, true],
            [18, -18, 0, false],
            [-24, -14, 0, true],
            [24, 2, Math.PI / 2, true],
          ]
        : [
            [-12, 10, Math.PI / 4, false],
            [14, 14, 0, true],
            [-18, -8, Math.PI / 2, true],
            [10, -10, -Math.PI / 5, false],
            [0, -22, Math.PI / 2, true],
            [22, -20, 0, false],
            [-26, 4, 0, true],
          ];

    containerSpots.forEach(([x, z, rot, olive]) => {
      const cont = createShippingContainer(
        olive ? textures.containerOliveMap : textures.containerRustMap
      );
      addObstacle(cont, x, z, 1.35, 3.15, 2.75, rot);
    });

    const barrierSpots: [number, number, number][] = [
      [0, 22, 0],
      [-6, 6, Math.PI / 8],
      [5, 4, -Math.PI / 8],
      [0, -10, 0],
      [-16, -24, Math.PI / 4],
      [14, -26, -Math.PI / 4],
    ];
    barrierSpots.forEach(([x, z, rot]) => {
      const barrier = createJerseyBarrier(textures.concreteMap);
      addObstacle(barrier, x, z, 1.65, 0.45, 1.15, rot);
    });

    const bunkerSpots: [number, number, number][] = [
      [-6, 28, 0],
      [18, 22, Math.PI / 3],
      [-20, 16, -Math.PI / 4],
      [4, -30, 0],
    ];
    bunkerSpots.forEach(([x, z, rot]) => {
      const bunker = createSandbagBunker();
      addObstacle(bunker, x, z, 1.75, 0.45, 1.08, rot);
    });

    // Extraction Helipad (North sector)
    const extractPos = new THREE.Vector3(0, 0, -34);
    const { group: extractPad, beaconBeam } = createExtractionPad(textures.helipadMap);
    extractPad.position.copy(extractPos);
    scene.add(extractPad);

    // Intel Crates
    const intelCoords: [number, number][] =
      loadout.mapId === 'zero_dam'
        ? [
            [-15, 4],
            [14, -12],
            [-6, -25],
          ]
        : [
            [-17, 2],
            [15, -4],
            [-14, -24],
            [16, -24],
          ];
    const intelEntities: IntelEntity[] = intelCoords.map(([ix, iz]) => {
      const { group, beaconRing } = createIntelCrate();
      group.position.set(ix, 0, iz);
      scene.add(group);
      return {
        group,
        beaconRing,
        pos: new THREE.Vector3(ix, 0, iz),
        collected: false,
      };
    });

    // Spawn Enemies
    const enemySpawns: [number, number, boolean][] = [
      [-12, 8, false],
      [11, 7, false],
      [-4, 0, false],
      [15, -4, true],
      [-18, -6, false],
      [6, -15, false],
      [-10, -18, true],
      [18, -16, false],
      [-2, -27, true],
      [10, -28, false],
      [-20, -22, false],
      [22, 6, true],
    ].slice(0, mapSpec.hostileCount) as [number, number, boolean][];

    const enemyHitMeshes: THREE.Object3D[] = [];
    const enemies: EnemyEntity[] = enemySpawns.map(([ex, ez, elite], index) => {
      const { group, headMesh, bodyMesh, leftLeg, rightLeg } = createEnemyOperator(elite);
      group.position.set(ex, 0, ez);
      scene.add(group);

      headMesh.userData.enemyId = index;
      bodyMesh.userData.enemyId = index;
      // Also tag child visor/rig meshes
      group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.userData.enemyId = index;
          if (!child.userData.hitbox) {
            child.userData.hitbox = 'body';
          }
          enemyHitMeshes.push(child);
        }
      });

      return {
        id: index,
        group,
        leftLeg,
        rightLeg,
        hp: elite ? 135 : 95,
        maxHp: elite ? 135 : 95,
        alive: true,
        elite,
        homePos: new THREE.Vector3(ex, 0, ez),
        patrolTarget: new THREE.Vector3(ex + (index % 2 === 0 ? 4 : -4), 0, ez),
        fireCooldown: 0.9 + Math.random() * 1.1,
        burstLeft: 0,
        alerted: false,
        walkPhase: Math.random() * Math.PI * 2,
        hitFlash: 0,
      };
    });

    // First-person weapon viewmodel rig attached to camera
    const weaponPivot = new THREE.Group();
    camera.add(weaponPivot);

    const primaryModel = createViewmodelWeapon(loadout, 'primary');
    const sidearmModel = createViewmodelWeapon(loadout, 'sidearm');
    sidearmModel.visible = false;
    weaponPivot.add(primaryModel, sidearmModel);

    // Muzzle flash light & mesh
    const muzzleLight = new THREE.PointLight(0xffb347, 0, 6);
    muzzleLight.position.set(0.05, 0.02, -0.75);
    weaponPivot.add(muzzleLight);

    const flashMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.9 })
    );
    flashMesh.position.set(0, 0.02, -0.82);
    flashMesh.visible = false;
    weaponPivot.add(flashMesh);

    // Runtime dynamic pools
    const tracers: TracerBeam[] = [];
    const particles: ParticleBurst[] = [];
    const grenades: GrenadeEntity[] = [];

    // Player Physics & Combat State
    const playerPos = new THREE.Vector3(0, 0, 34);
    const playerVel = new THREE.Vector3();
    let yaw = 0;
    let pitch = 0;
    let eyeHeight = 1.68;
    let grounded = true;
    let recoilPitch = 0;
    let recoilYaw = 0;
    let weaponKickZ = 0;
    let weaponBob = 0;
    let muzzleFlashTimer = 0;

    let hp = 100;
    const maxHp = 100;
    const maxArmor = 75 + operatorSpec.armorBonus;
    let armor = maxArmor;

    let activeSlot: 'primary' | 'sidearm' = 'primary';
    let primaryAmmo = ballistics.magCapacity;
    let primaryReserve = ballistics.magCapacity * 4;
    let sidearmAmmo = 15;
    let sidearmReserve = 60;
    let grenadeCount = 2;

    let reloadTimer = 0;
    let fireTimer = 0;
    let isFiring = false;
    let isAds = false;
    let isCrouching = false;
    let isPaused = false;
    let isFinished = false;

    let eliminations = 0;
    let headshots = 0;
    let shotsFired = 0;
    let shotsHit = 0;
    let intelCollected = 0;
    let timeRemaining = mapSpec.timeLimitSec;
    let elapsedMissionSec = 0;
    let extractionProgress = 0;
    let hitmarkerTimer = 0;
    let hitmarkerKind: HudState['hitmarker'] = 'none';
    let damageFlash = 0;
    let bannerTimer = 0;
    let statusBanner: string | null = '已部署至作戰區 · 點擊畫面鎖定滑鼠準心';
    bannerTimer = 4.5;

    const keys: Record<string, boolean> = {};
    const raycaster = new THREE.Raycaster();
    const centerNdc = new THREE.Vector2(0, 0);

    const showBanner = (msg: string, dur = 2.8) => {
      statusBanner = msg;
      bannerTimer = dur;
    };

    const spawnTracer = (start: THREE.Vector3, end: THREE.Vector3, colorHex: number) => {
      const dist = start.distanceTo(end);
      const geo = new THREE.CylinderGeometry(0.012, 0.012, Math.max(0.2, dist), 6);
      geo.rotateX(Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.78,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(start).lerp(end, 0.5);
      mesh.lookAt(end);
      scene.add(mesh);
      tracers.push({ mesh, life: 0.075 });
    };

    const spawnSparks = (pos: THREE.Vector3, colorHex: number, count = 6, speed = 5) => {
      const geo = new THREE.BoxGeometry(0.055, 0.055, 0.055);
      for (let i = 0; i < count; i++) {
        const mat = new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0.9,
        });
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(pos);
        scene.add(m);
        particles.push({
          mesh: m,
          vel: new THREE.Vector3(
            (Math.random() - 0.5) * speed,
            Math.random() * speed * 0.8 + 1.2,
            (Math.random() - 0.5) * speed
          ),
          life: 0.35 + Math.random() * 0.2,
          maxLife: 0.55,
        });
      }
    };

    const finishMission = (extracted: boolean) => {
      if (isFinished) return;
      isFinished = true;
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
      const report: CombatReport = {
        mapId: loadout.mapId,
        weaponName: weaponSpec.name,
        extracted,
        eliminations,
        headshots,
        shotsFired,
        shotsHit,
        intelCollected,
        intelTotal: intelEntities.length,
        durationSec: Math.round(elapsedMissionSec),
        timestamp: new Date().toLocaleTimeString('zh-Hant', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      onMissionComplete(report);
      setHud((prev) => ({
        ...prev,
        finished: report,
        pointerLocked: false,
      }));
    };

    const damageEnemy = (enemy: EnemyEntity, dmg: number, isHead: boolean, hitPoint: THREE.Vector3) => {
      if (!enemy.alive) return;
      enemy.hp -= dmg;
      enemy.alerted = true;
      enemy.hitFlash = 0.14;
      spawnSparks(hitPoint, isHead ? 0xf59e0b : 0xef4444, isHead ? 9 : 5, 4.5);

      if (enemy.hp <= 0) {
        enemy.alive = false;
        enemy.group.rotation.x = -Math.PI / 2;
        enemy.group.position.y = 0.22;
        eliminations += 1;
        if (isHead) headshots += 1;
        hitmarkerKind = 'kill';
        hitmarkerTimer = 0.25;
        soundEngine.playHitmarker(true);
        const aliveLeft = enemies.filter((e) => e.alive).length;
        showBanner(
          isHead ? `精準爆頭擊倒目標 · 剩餘敵軍 ${aliveLeft}` : `目標已肅清 · 剩餘敵軍 ${aliveLeft}`,
          2.0
        );
      } else {
        hitmarkerKind = isHead ? 'headshot' : 'hit';
        hitmarkerTimer = 0.16;
        soundEngine.playHitmarker(isHead);
      }
    };

    const fireWeapon = () => {
      if (isPaused || isFinished || reloadTimer > 0) return;

      if (activeSlot === 'primary') {
        if (primaryAmmo <= 0) {
          startReload();
          return;
        }
        primaryAmmo -= 1;
        fireTimer = 60 / ballistics.rpm;
      } else {
        if (sidearmAmmo <= 0) {
          startReload();
          return;
        }
        sidearmAmmo -= 1;
        fireTimer = 0.16;
      }

      shotsFired += 1;
      const isPrimary = activeSlot === 'primary';
      const isSuppressed = isPrimary ? ballistics.suppressed : true;

      soundEngine.playGunshot({
        suppressed: isSuppressed,
        heavy: isPrimary && (loadout.weaponId === 'awm' || loadout.weaponId === 'ak12'),
      });

      // Recoil & muzzle flash
      const controlFactor = isPrimary ? (110 - ballistics.recoilControl) / 100 : 0.28;
      const adsMul = isAds ? 0.58 : 1.0;
      const crouchMul = isCrouching ? 0.72 : 1.0;
      recoilPitch += (0.022 + controlFactor * 0.035) * adsMul * crouchMul;
      recoilYaw += (Math.random() - 0.5) * 0.014 * controlFactor * adsMul;
      weaponKickZ = 0.075;
      muzzleFlashTimer = isSuppressed ? 0.03 : 0.06;

      // Ballistic Raycast
      const spread = (isAds ? 0.0015 : 0.014) * (isCrouching ? 0.7 : 1.0);
      const aimX = (Math.random() - 0.5) * spread;
      const aimY = (Math.random() - 0.5) * spread;
      centerNdc.set(aimX, aimY);
      raycaster.setFromCamera(centerNdc, camera);
      raycaster.far = isPrimary ? ballistics.effectiveRange + 40 : 65;

      const targets = [
        ...enemyHitMeshes.filter((m) => {
          const eid = m.userData.enemyId as number | undefined;
          return eid !== undefined && enemies[eid]?.alive;
        }),
        ...environmentMeshes,
      ];
      const hits = raycaster.intersectObjects(targets, true);

      // Compute world muzzle start for tracer
      const muzzleStart = new THREE.Vector3(0.14, -0.09, -0.85).applyMatrix4(camera.matrixWorld);
      let impactPoint = raycaster.ray.origin
        .clone()
        .add(raycaster.ray.direction.clone().multiplyScalar(80));

      if (hits.length > 0) {
        const hit = hits[0];
        impactPoint = hit.point;
        const eid = hit.object.userData.enemyId as number | undefined;
        if (eid !== undefined && enemies[eid]?.alive) {
          shotsHit += 1;
          const isHead = hit.object.userData.hitbox === 'head';
          const baseDmg = isPrimary ? ballistics.damage : 24;
          const distFalloff =
            hit.distance > ballistics.effectiveRange
              ? Math.max(0.55, 1 - (hit.distance - ballistics.effectiveRange) * 0.008)
              : 1;
          const finalDmg = Math.round(baseDmg * distFalloff * (isHead ? 2.4 : 1.0));
          damageEnemy(enemies[eid], finalDmg, isHead, hit.point);
        } else {
          spawnSparks(hit.point, 0xd1d5db, 4, 3.2);
        }
      }

      spawnTracer(muzzleStart, impactPoint, isSuppressed ? 0xfcd34d : 0xfbbf24);

      if (!ballistics.auto || activeSlot === 'sidearm') {
        isFiring = false;
      }
    };

    const startReload = () => {
      if (reloadTimer > 0) return;
      if (activeSlot === 'primary') {
        if (primaryAmmo >= ballistics.magCapacity || primaryReserve <= 0) return;
        reloadTimer = ballistics.reloadSec;
      } else {
        if (sidearmAmmo >= 15 || sidearmReserve <= 0) return;
        reloadTimer = 1.25;
      }
      soundEngine.playReload();
      showBanner('正在更換彈匣...', reloadTimer);
    };

    const throwGrenade = () => {
      if (grenadeCount <= 0 || isPaused || isFinished) return;
      grenadeCount -= 1;
      const gMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0x3b4d36, roughness: 0.5, metalness: 0.5 })
      );
      camera.getWorldDirection(_forward);
      gMesh.position.copy(camera.position).addScaledVector(_forward, 0.7);
      scene.add(gMesh);

      const vel = _forward.clone().multiplyScalar(17);
      vel.y += 4.5;
      grenades.push({ mesh: gMesh, vel, fuse: 1.4 });
      showBanner(`破片手榴彈已投出 · 剩餘 ${grenadeCount} 枚`, 1.8);
    };

    const handleInteract = () => {
      if (isPaused || isFinished) return;
      // Check nearby intel crate
      for (const item of intelEntities) {
        if (!item.collected && playerPos.distanceTo(item.pos) < 3.4) {
          item.collected = true;
          item.group.visible = false;
          intelCollected += 1;
          soundEngine.playPickup();
          showBanner(
            intelCollected >= intelEntities.length
              ? '全部加密情報已取得 · 請前往綠色撤離點'
              : `已擷取加密情報 (${intelCollected}/${intelEntities.length})`,
            3.0
          );
          return;
        }
      }

      // Check extraction pad
      if (playerPos.distanceTo(extractPos) < 4.8) {
        const canExtract =
          intelCollected >= intelEntities.length ||
          enemies.filter((e) => !e.alive).length >= Math.ceil(enemies.length * 0.5);
        if (!canExtract) {
          showBanner('須先收集全部情報或肅清至少半數敵軍方可撤離', 2.6);
        } else {
          showBanner('撤離信標已啟動 · 堅守停機坪 3 秒完成撤離', 3.0);
        }
      }
    };

    // Collision helper against cover AABBs
    const resolvePlayerCollision = (pos: THREE.Vector3) => {
      const r = 0.45;
      pos.x = THREE.MathUtils.clamp(pos.x, -42, 42);
      pos.z = THREE.MathUtils.clamp(pos.z, -40, 42);
      for (const box of obstacles) {
        if (pos.y > box.maxY - 0.1) continue;
        if (
          pos.x + r > box.minX &&
          pos.x - r < box.maxX &&
          pos.z + r > box.minZ &&
          pos.z - r < box.maxZ
        ) {
          const dx1 = box.maxX - (pos.x - r);
          const dx2 = pos.x + r - box.minX;
          const dz1 = box.maxZ - (pos.z - r);
          const dz2 = pos.z + r - box.minZ;
          const minOverlap = Math.min(dx1, dx2, dz1, dz2);
          if (minOverlap === dx1) pos.x = box.maxX + r;
          else if (minOverlap === dx2) pos.x = box.minX - r;
          else if (minOverlap === dz1) pos.z = box.maxZ + r;
          else pos.z = box.minZ - r;
        }
      }
    };

    // Input Event Listeners
    let draggingFallback = false;

    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
      if (e.code === 'KeyR') startReload();
      if (e.code === 'Digit1') {
        activeSlot = 'primary';
        primaryModel.visible = true;
        sidearmModel.visible = false;
        reloadTimer = 0;
      }
      if (e.code === 'Digit2') {
        activeSlot = 'sidearm';
        primaryModel.visible = false;
        sidearmModel.visible = true;
        reloadTimer = 0;
      }
      if (e.code === 'KeyG') throwGrenade();
      if (e.code === 'KeyE') handleInteract();
      if (e.code === 'KeyC') isCrouching = !isCrouching;
      if (e.code === 'KeyF') isAds = !isAds;
      if (e.code === 'Space' && grounded && !isPaused) {
        playerVel.y = 6.2;
        grounded = false;
      }
      if (e.code === 'KeyP') {
        isPaused = !isPaused;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isPaused || isFinished) return;
      if (document.pointerLockElement === canvas || draggingFallback) {
        const adsSens = isAds ? 0.58 : 1.0;
        const s = sensitivityRef.current * adsSens;
        yaw -= e.movementX * s;
        pitch = THREE.MathUtils.clamp(
          pitch - e.movementY * s,
          -Math.PI / 2.2,
          Math.PI / 2.2
        );
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (isPaused || isFinished) return;
      if (e.button === 0) {
        if (document.pointerLockElement !== canvas) {
          try {
            canvas.requestPointerLock();
          } catch {
            draggingFallback = true;
          }
        }
        isFiring = true;
        if (fireTimer <= 0) fireWeapon();
      } else if (e.button === 2) {
        isAds = true;
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        isFiring = false;
        draggingFallback = false;
      } else if (e.button === 2) {
        isAds = false;
      }
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      setHud((prev) => ({
        ...prev,
        pointerLocked: locked,
      }));
    };

    const onPointerLockError = () => {
      showBanner('按住左鍵拖曳即可瞄準射擊（或點擊準心鎖定）', 3.0);
    };

    const onResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('pointerlockerror', onPointerLockError);
    window.addEventListener('resize', onResize);

    actionsRef.current = {
      lockPointer: () => {
        isPaused = false;
        try {
          canvas.requestPointerLock();
        } catch {
          // fallback allowed
        }
      },
      resumeGame: () => {
        isPaused = false;
        try {
          canvas.requestPointerLock();
        } catch {
          // fallback allowed
        }
      },
      togglePause: () => {
        isPaused = !isPaused;
        if (isPaused && document.pointerLockElement === canvas) {
          document.exitPointerLock();
        }
      },
      forceRestart: () => {
        setRunSeed((s) => s + 1);
      },
    };

    // Main Game Loop with Software-WebGL Pacing
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let hudSyncTimer = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.05);

      if (!isPaused && !isFinished) {
        elapsedMissionSec += delta;
        timeRemaining = Math.max(0, timeRemaining - delta);
        if (timeRemaining <= 0) {
          finishMission(false);
        }

        // Reload countdown
        if (reloadTimer > 0) {
          reloadTimer -= delta;
          if (reloadTimer <= 0) {
            reloadTimer = 0;
            if (activeSlot === 'primary') {
              const needed = ballistics.magCapacity - primaryAmmo;
              const take = Math.min(needed, primaryReserve);
              primaryAmmo += take;
              primaryReserve -= take;
            } else {
              const needed = 15 - sidearmAmmo;
              const take = Math.min(needed, sidearmReserve);
              sidearmAmmo += take;
              sidearmReserve -= take;
            }
          }
        }

        // Auto fire
        if (fireTimer > 0) fireTimer -= delta;
        if (isFiring && fireTimer <= 0 && reloadTimer <= 0) {
          fireWeapon();
        }

        // Movement input
        const sprint = (keys['ShiftLeft'] || keys['ShiftRight']) && !isAds && !isCrouching;
        const baseSpeed = 6.2 * operatorSpec.speedMultiplier;
        const moveSpeed = isCrouching ? baseSpeed * 0.56 : isAds ? baseSpeed * 0.65 : sprint ? baseSpeed * 1.42 : baseSpeed;

        const moveZ = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
        const moveX = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);

        _forward.set(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
        _right.set(Math.cos(yaw), 0, -Math.sin(yaw)).normalize();

        _moveVec.set(0, 0, 0);
        if (moveZ !== 0) _moveVec.addScaledVector(_forward, moveZ);
        if (moveX !== 0) _moveVec.addScaledVector(_right, moveX);
        if (_moveVec.lengthSq() > 0) {
          _moveVec.normalize().multiplyScalar(moveSpeed * delta);
          playerPos.add(_moveVec);
          weaponBob += delta * (sprint ? 12 : 7.5);
        } else {
          weaponBob = THREE.MathUtils.damp(weaponBob, 0, 8, delta);
        }

        // Vertical jump & gravity
        playerVel.y -= 17.5 * delta;
        playerPos.y += playerVel.y * delta;
        if (playerPos.y <= 0) {
          playerPos.y = 0;
          playerVel.y = 0;
          grounded = true;
        }
        resolvePlayerCollision(playerPos);

        // Smooth crouch eye height & recoil recovery
        const targetEye = isCrouching ? 1.12 : 1.68;
        eyeHeight = THREE.MathUtils.damp(eyeHeight, targetEye, 12, delta);
        recoilPitch = THREE.MathUtils.damp(recoilPitch, 0, 9, delta);
        recoilYaw = THREE.MathUtils.damp(recoilYaw, 0, 9, delta);

        camera.position.set(playerPos.x, playerPos.y + eyeHeight, playerPos.z);
        camera.rotation.y = yaw + recoilYaw;
        camera.rotation.x = THREE.MathUtils.clamp(
          pitch + recoilPitch,
          -Math.PI / 2.1,
          Math.PI / 2.1
        );

        // Smooth FOV & ADS weapon positioning
        const targetFov = isAds
          ? activeSlot === 'primary'
            ? ballistics.adsFov
            : 60
          : sprint
          ? 79
          : baseFov;
        if (Math.abs(camera.fov - targetFov) > 0.05) {
          camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 14, delta);
          camera.updateProjectionMatrix();
        }

        weaponKickZ = THREE.MathUtils.damp(weaponKickZ, 0, 16, delta);
        const targetWeaponX = isAds ? 0 : 0.22 + Math.cos(weaponBob * 0.5) * 0.008;
        const targetWeaponY = isAds
          ? activeSlot === 'primary'
            ? -0.075
            : -0.055
          : -0.19 + Math.abs(Math.sin(weaponBob)) * 0.012;
        const targetWeaponZ = isAds ? -0.26 + weaponKickZ : -0.4 + weaponKickZ;
        const reloadTilt = reloadTimer > 0 ? -0.45 : 0;

        weaponPivot.position.x = THREE.MathUtils.damp(weaponPivot.position.x, targetWeaponX, 18, delta);
        weaponPivot.position.y = THREE.MathUtils.damp(weaponPivot.position.y, targetWeaponY, 18, delta);
        weaponPivot.position.z = THREE.MathUtils.damp(weaponPivot.position.z, targetWeaponZ, 18, delta);
        weaponPivot.rotation.x = THREE.MathUtils.damp(
          weaponPivot.rotation.x,
          reloadTilt + weaponKickZ * 1.4,
          14,
          delta
        );

        // Muzzle flash decay
        if (muzzleFlashTimer > 0) {
          muzzleFlashTimer -= delta;
          muzzleLight.intensity = 4.5;
          flashMesh.visible = true;
          flashMesh.rotation.z += delta * 25;
        } else {
          muzzleLight.intensity = 0;
          flashMesh.visible = false;
        }

        // Animate radar dish & intel rings
        scene.traverse((obj) => {
          if (obj.userData.dish) {
            (obj.userData.dish as THREE.Group).rotation.y += delta * 0.55;
          }
        });
        intelEntities.forEach((item) => {
          if (!item.collected) {
            const s = 1 + Math.sin(elapsedMissionSec * 4) * 0.12;
            item.beaconRing.scale.set(s, s, 1);
          }
        });
        beaconBeam.rotation.y += delta * 0.8;

        // Update grenades
        for (let i = grenades.length - 1; i >= 0; i--) {
          const g = grenades[i];
          g.fuse -= delta;
          g.vel.y -= 15.5 * delta;
          g.mesh.position.addScaledVector(g.vel, delta);
          if (g.mesh.position.y < 0.1) {
            g.mesh.position.y = 0.1;
            g.vel.y *= -0.42;
            g.vel.x *= 0.65;
            g.vel.z *= 0.65;
          }
          if (g.fuse <= 0) {
            soundEngine.playExplosion();
            spawnSparks(g.mesh.position, 0xf59e0b, 18, 12);
            enemies.forEach((en) => {
              if (!en.alive) return;
              const dist = en.group.position.distanceTo(g.mesh.position);
              if (dist < 7.5) {
                const dmg = Math.round(135 * (1 - dist / 8.5));
                damageEnemy(en, dmg, false, en.group.position.clone().setY(1.1));
              }
            });
            scene.remove(g.mesh);
            g.mesh.geometry.dispose();
            grenades.splice(i, 1);
          }
        }

        // Update Enemy AI
        _eyeVec.set(playerPos.x, playerPos.y + eyeHeight - 0.15, playerPos.z);
        for (const en of enemies) {
          if (!en.alive) continue;

          const toPlayer = _tempVec.subVectors(playerPos, en.group.position);
          toPlayer.y = 0;
          const distToPlayer = toPlayer.length();

          // Check line of sight to player
          let hasLos = false;
          if (distToPlayer < 46) {
            const enemyEye = en.group.position.clone().setY(1.52);
            _rayDir.subVectors(_eyeVec, enemyEye).normalize();
            raycaster.set(enemyEye, _rayDir);
            raycaster.far = distToPlayer;
            const blockHits = raycaster.intersectObjects(environmentMeshes, true);
            hasLos = blockHits.length === 0;
            if (hasLos) en.alerted = true;
          }

          if (en.alerted && distToPlayer > 7.5) {
            // Move toward player / tactical flank
            toPlayer.normalize();
            const moveStep = (en.elite ? 2.8 : 2.2) * delta;
            const nextPos = en.group.position.clone().addScaledVector(toPlayer, moveStep);
            // Simple obstacle avoidance
            let blocked = false;
            for (const box of obstacles) {
              if (
                nextPos.x + 0.4 > box.minX &&
                nextPos.x - 0.4 < box.maxX &&
                nextPos.z + 0.4 > box.minZ &&
                nextPos.z - 0.4 < box.maxZ
              ) {
                blocked = true;
                break;
              }
            }
            if (!blocked) {
              en.group.position.copy(nextPos);
              en.walkPhase += delta * 7;
              en.leftLeg.rotation.x = Math.sin(en.walkPhase) * 0.45;
              en.rightLeg.rotation.x = -Math.sin(en.walkPhase) * 0.45;
            }
            en.group.lookAt(playerPos.x, 0, playerPos.z);
          } else if (!en.alerted) {
            // Patrol between home and patrolTarget
            const toTarget = en.patrolTarget.clone().sub(en.group.position);
            toTarget.y = 0;
            if (toTarget.length() < 0.6) {
              const swap = en.patrolTarget.clone();
              en.patrolTarget.copy(en.homePos);
              en.homePos.copy(swap);
            } else {
              toTarget.normalize();
              en.group.position.addScaledVector(toTarget, 1.45 * delta);
              en.group.lookAt(en.patrolTarget.x, 0, en.patrolTarget.z);
              en.walkPhase += delta * 5;
              en.leftLeg.rotation.x = Math.sin(en.walkPhase) * 0.3;
              en.rightLeg.rotation.x = -Math.sin(en.walkPhase) * 0.3;
            }
          } else {
            en.group.lookAt(playerPos.x, 0, playerPos.z);
            en.leftLeg.rotation.x = 0;
            en.rightLeg.rotation.x = 0;
          }

          // Enemy firing
          if (hasLos && en.alerted) {
            en.fireCooldown -= delta;
            if (en.fireCooldown <= 0) {
              if (en.burstLeft <= 0) {
                en.burstLeft = en.elite ? 3 : 2;
              }
              en.burstLeft -= 1;
              en.fireCooldown = en.burstLeft > 0 ? 0.16 : 1.35 + Math.random() * 0.85;

              soundEngine.playGunshot({ suppressed: false, enemy: true });
              const muzzleOrigin = en.group.position.clone().setY(1.32);
              const accuracyChance = Math.max(0.18, 0.52 - distToPlayer * 0.008) * (isCrouching ? 0.78 : 1);
              if (Math.random() < accuracyChance) {
                const incomingDmg = en.elite ? 11 : 8;
                if (armor > 0) {
                  const absorbed = Math.min(armor, Math.ceil(incomingDmg * 0.65));
                  armor -= absorbed;
                  hp -= incomingDmg - absorbed;
                } else {
                  hp -= incomingDmg;
                }
                damageFlash = 0.45;
                spawnTracer(muzzleOrigin, _eyeVec.clone().add(new THREE.Vector3(0, -0.1, 0)), 0xef4444);
                if (hp <= 0) {
                  hp = 0;
                  finishMission(false);
                }
              } else {
                const missTarget = _eyeVec.clone().add(
                  new THREE.Vector3((Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 1.1, (Math.random() - 0.5) * 2.2)
                );
                spawnTracer(muzzleOrigin, missTarget, 0xf87171);
              }
            }
          }
        }

        // Update tracers
        for (let i = tracers.length - 1; i >= 0; i--) {
          tracers[i].life -= delta;
          if (tracers[i].life <= 0) {
            scene.remove(tracers[i].mesh);
            tracers[i].mesh.geometry.dispose();
            (tracers[i].mesh.material as THREE.Material).dispose();
            tracers.splice(i, 1);
          }
        }

        // Update particles
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.life -= delta;
          p.vel.y -= 12 * delta;
          p.mesh.position.addScaledVector(p.vel, delta);
          (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, p.life / p.maxLife);
          if (p.life <= 0) {
            scene.remove(p.mesh);
            (p.mesh.material as THREE.Material).dispose();
            particles.splice(i, 1);
          }
        }

        // Check Extraction progress
        const canExtract =
          intelCollected >= intelEntities.length ||
          eliminations >= Math.ceil(enemies.length * 0.5);
        const onHelipad = playerPos.distanceTo(extractPos) < 4.5;
        let extractingNow = false;
        if (onHelipad && canExtract) {
          extractingNow = true;
          extractionProgress = Math.min(100, extractionProgress + delta * 34);
          if (extractionProgress >= 100) {
            soundEngine.playPickup();
            finishMission(true);
          }
        } else {
          extractionProgress = Math.max(0, extractionProgress - delta * 25);
        }

        // Timers decay
        if (hitmarkerTimer > 0) {
          hitmarkerTimer -= delta;
          if (hitmarkerTimer <= 0) hitmarkerKind = 'none';
        }
        if (damageFlash > 0) damageFlash = Math.max(0, damageFlash - delta * 1.4);
        if (bannerTimer > 0) {
          bannerTimer -= delta;
          if (bannerTimer <= 0) statusBanner = null;
        }

        // Sync HUD at ~15Hz
        hudSyncTimer += delta;
        if (hudSyncTimer >= 0.065) {
          hudSyncTimer = 0;

          let nearPrompt: string | null = null;
          for (const item of intelEntities) {
            if (!item.collected && playerPos.distanceTo(item.pos) < 3.4) {
              nearPrompt = '按 [E] 擷取加密情報箱';
              break;
            }
          }
          if (!nearPrompt && onHelipad) {
            nearPrompt = canExtract
              ? '正在撤離區域內 · 保持位置等待直升機接應'
              : '撤離鎖定：請先取得全部情報或肅清至少半數敵軍';
          }

          const hostilesLeft = enemies.filter((e) => e.alive).length;
          setHud((prev) => ({
            ...prev,
            hp: Math.round(hp),
            maxHp,
            armor: Math.round(armor),
            maxArmor,
            ammo: primaryAmmo,
            reserve: primaryReserve,
            sidearmAmmo,
            sidearmReserve,
            activeSlot,
            grenades: grenadeCount,
            reloading: reloadTimer > 0,
            ads: isAds,
            crouching: isCrouching,
            hostilesLeft,
            intelCollected,
            timeRemaining: Math.ceil(timeRemaining),
            nearPrompt,
            extractionProgress: Math.round(extractionProgress),
            extracting: extractingNow,
            hitmarker: hitmarkerKind,
            damageFlash,
            statusBanner,
            paused: isPaused,
          }));
        }
      } else {
        setHud((prev) => (prev.paused !== isPaused ? { ...prev, paused: isPaused } : prev));
      }

      renderer.render(scene, camera);
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('pointerlockerror', onPointerLockError);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);

      textures.dispose();
      envRT.dispose();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material.dispose();
          }
        }
      });
      renderer.dispose();
    };
  }, [loadout, runSeed]);

  const formatClock = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0B0E11] select-none">
      {/* Dedicated WebGL Mount Container */}
      <div ref={mountRef} className="absolute inset-0 cursor-crosshair" />

      {/* Damage Vignette */}
      {hud.damageFlash > 0 && (
        <div
          className="pointer-events-none absolute inset-0 border-[18px] border-red-600/50 transition-opacity duration-75"
          style={{ opacity: hud.damageFlash }}
        />
      )}

      {/* Magnified Optic Vignette when ADS with 2.5x scope */}
      {hud.ads && loadout.opticId === 'acog_25x' && hud.activeSlot === 'primary' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-[340px] h-[340px] rounded-full border-2 border-amber-400/60 shadow-[0_0_0_9999px_rgba(6,8,10,0.68)]" />
        </div>
      )}

      {/* Center Dynamic Crosshair & Hitmarker */}
      {!hud.finished && !hud.paused && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative flex items-center justify-center">
            {/* Crosshair lines */}
            {!(hud.ads && loadout.opticId === 'red_dot' && hud.activeSlot === 'primary') ? (
              <>
                <div
                  className={`absolute w-3 h-[2px] bg-white/90 transition-transform duration-75 ${
                    hud.ads ? '-translate-x-2' : hud.crouching ? '-translate-x-3' : '-translate-x-4'
                  }`}
                />
                <div
                  className={`absolute w-3 h-[2px] bg-white/90 transition-transform duration-75 ${
                    hud.ads ? 'translate-x-2' : hud.crouching ? 'translate-x-3' : 'translate-x-4'
                  }`}
                />
                <div
                  className={`absolute h-3 w-[2px] bg-white/90 transition-transform duration-75 ${
                    hud.ads ? '-translate-y-2' : hud.crouching ? '-translate-y-3' : '-translate-y-4'
                  }`}
                />
                <div
                  className={`absolute h-3 w-[2px] bg-white/90 transition-transform duration-75 ${
                    hud.ads ? 'translate-y-2' : hud.crouching ? 'translate-y-3' : 'translate-y-4'
                  }`}
                />
                <div className="w-1 h-1 bg-amber-400 rounded-full" />
              </>
            ) : (
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_6px_rgba(239,68,68,0.9)]" />
            )}

            {/* Hitmarker X */}
            {hud.hitmarker !== 'none' && (
              <svg
                viewBox="0 0 24 24"
                className={`absolute w-7 h-7 ${
                  hud.hitmarker === 'kill' || hud.hitmarker === 'headshot'
                    ? 'text-red-500'
                    : 'text-amber-400'
                }`}
                stroke="currentColor"
                strokeWidth="2.4"
              >
                <line x1="4" y1="4" x2="9" y2="9" />
                <line x1="20" y1="4" x2="15" y2="9" />
                <line x1="4" y1="20" x2="9" y2="15" />
                <line x1="20" y1="20" x2="15" y2="15" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Top-Center Compact Objective Strip (No backdrop-filter over WebGL) */}
      <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-6 px-5 py-2.5 bg-[#0F1318]/90 border border-white/10 rounded-md text-xs text-slate-200">
        <span className="font-semibold text-amber-400 whitespace-nowrap">{mapSpec.name}</span>
        <span aria-hidden="true" className="text-slate-600">·</span>
        <span className="font-mono-tabular whitespace-nowrap">
          敵軍剩餘 <strong className="text-white">{hud.hostilesLeft}</strong>/{hud.hostilesTotal}
        </span>
        <span aria-hidden="true" className="text-slate-600">·</span>
        <span className="font-mono-tabular whitespace-nowrap">
          加密情報 <strong className="text-emerald-400">{hud.intelCollected}</strong>/{hud.intelTotal}
        </span>
        <span aria-hidden="true" className="text-slate-600">·</span>
        <span className="font-mono-tabular text-amber-300 whitespace-nowrap">
          {formatClock(hud.timeRemaining)}
        </span>
      </div>

      {/* Top-Left Exit & Top-Right Audio/Pause Controls */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#0F1318]/90 hover:bg-[#1A2028] text-slate-200 border border-white/10 rounded-md transition-colors whitespace-nowrap"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          返回基地
        </button>
      </div>

      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleMute}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#0F1318]/90 hover:bg-[#1A2028] text-slate-200 border border-white/10 rounded-md transition-colors whitespace-nowrap"
        >
          {muted ? <VolumeX className="w-3.5 h-3.5 text-slate-400" /> : <Volume2 className="w-3.5 h-3.5 text-amber-400" />}
          {muted ? '靜音' : '音效'}
        </button>
        <button
          type="button"
          onClick={() => actionsRef.current.togglePause()}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#0F1318]/90 hover:bg-[#1A2028] text-slate-200 border border-white/10 rounded-md transition-colors whitespace-nowrap"
        >
          <Pause className="w-3.5 h-3.5" />
          暫停
        </button>
      </div>

      {/* Status & Contextual Interaction Prompt */}
      <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
        {hud.statusBanner && (
          <div className="px-4 py-1.5 bg-[#0F1318]/90 border border-amber-500/30 rounded text-xs text-amber-200 whitespace-nowrap">
            {hud.statusBanner}
          </div>
        )}
        {hud.nearPrompt && (
          <div className="px-4 py-2 bg-[#0F1318]/95 border border-emerald-500/40 rounded text-sm font-medium text-emerald-300 whitespace-nowrap">
            {hud.nearPrompt}
          </div>
        )}
        {hud.extracting && (
          <div className="w-64 bg-[#0F1318]/95 border border-emerald-500/40 rounded p-2">
            <div className="flex justify-between text-[11px] text-emerald-300 mb-1 font-mono-tabular">
              <span>直升機撤離進度</span>
              <span>{hud.extractionProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-75"
                style={{ width: `${hud.extractionProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom-Left Player Vitals */}
      <div className="pointer-events-none absolute bottom-5 left-5 z-10 w-64 bg-[#0F1318]/90 border border-white/10 rounded-md p-3.5">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span>生命值</span>
          <span className="font-mono-tabular text-sm font-semibold text-white">{hud.hp}</span>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-sm overflow-hidden mb-2.5">
          <div
            className={`h-full transition-all duration-100 ${
              hud.hp > 35 ? 'bg-emerald-500' : 'bg-red-500'
            }`}
            style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span>防彈護甲 · {operatorSpec.name}</span>
          <span className="font-mono-tabular text-xs font-semibold text-sky-300">{hud.armor}</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-sm overflow-hidden">
          <div
            className="h-full bg-sky-400 transition-all duration-100"
            style={{ width: `${hud.maxArmor > 0 ? (hud.armor / hud.maxArmor) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Bottom-Center Compact Controls Hint */}
      <div className="pointer-events-none hidden lg:flex absolute bottom-5 left-1/2 -translate-x-1/2 z-10 items-center gap-3 px-4 py-2 bg-[#0F1318]/85 border border-white/10 rounded-md text-[11px] text-slate-400 whitespace-nowrap">
        <span>WASD 移動</span>
        <span aria-hidden="true">·</span>
        <span>左鍵射擊 / 右鍵或 F 開鏡</span>
        <span aria-hidden="true">·</span>
        <span>R 換彈</span>
        <span aria-hidden="true">·</span>
        <span>G 手榴彈 ({hud.grenades})</span>
        <span aria-hidden="true">·</span>
        <span>E 收集情報 / 撤離</span>
        <span aria-hidden="true">·</span>
        <span>1/2 切換武器</span>
      </div>

      {/* Bottom-Right Weapon & Ammo Readout */}
      <div className="pointer-events-none absolute bottom-5 right-5 z-10 bg-[#0F1318]/90 border border-white/10 rounded-md px-4 py-3 text-right min-w-[210px]">
        <div className="text-xs text-amber-400 font-medium mb-1">
          {hud.activeSlot === 'primary' ? weaponSpec.name : 'P226 戰術手槍'}
        </div>
        <div className="flex items-baseline justify-end gap-1.5 font-mono-tabular">
          <span className="text-3xl font-bold text-white">
            {hud.reloading
              ? '---'
              : hud.activeSlot === 'primary'
              ? hud.ammo
              : hud.sidearmAmmo}
          </span>
          <span className="text-sm text-slate-400">
            / {hud.activeSlot === 'primary' ? hud.reserve : hud.sidearmReserve}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-end gap-2 text-[11px] text-slate-400">
          <span>{hud.activeSlot === 'primary' ? (ballistics.auto ? '全自動' : '單發栓動') : '半自動'}</span>
          <span aria-hidden="true">·</span>
          <span>手榴彈 {hud.grenades}</span>
        </div>
      </div>

      {/* Click-to-Lock Aim Prompt when unlocked and not paused */}
      {!hud.pointerLocked && !hud.paused && !hud.finished && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 z-10">
          <button
            type="button"
            onClick={() => actionsRef.current.lockPointer()}
            className="pointer-events-auto flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-md transition-colors whitespace-nowrap"
          >
            <Crosshair className="w-4 h-4" />
            點擊畫面鎖定滑鼠準心開始戰鬥
          </button>
        </div>
      )}

      {/* Pause Overlay */}
      {hud.paused && !hud.finished && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#080A0D]/85">
          <div className="w-full max-w-md bg-[#12161C] border border-white/10 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-1">作戰暫停</h2>
            <p className="text-xs text-slate-400 mb-5">
              {mapSpec.name} · {weaponSpec.name}
            </p>

            <div className="mb-6">
              <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
                <span>滑鼠瞄準靈敏度</span>
                <span className="font-mono-tabular text-amber-400">
                  {(sensitivity * 1000).toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min={0.0008}
                max={0.0045}
                step={0.0002}
                value={sensitivity}
                onChange={(e) => setSensitivity(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => actionsRef.current.resumeGame()}
                className="px-4 py-2.5 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-md transition-colors"
              >
                繼續戰鬥
              </button>
              <button
                type="button"
                onClick={() => actionsRef.current.forceRestart()}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium bg-[#1C222B] hover:bg-[#252C38] text-slate-200 border border-white/10 rounded-md transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                重新部署
              </button>
            </div>
            <button
              type="button"
              onClick={onExit}
              className="mt-3 w-full px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              中止行動並返回基地
            </button>
          </div>
        </div>
      )}

      {/* Mission End Debrief Overlay */}
      {hud.finished && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#080A0D]/90 p-4">
          <div className="w-full max-w-lg bg-[#12161C] border border-white/10 rounded-lg p-6">
            <div className="text-xs font-medium text-slate-400 mb-1">
              {mapSpec.name} · 作戰結算報告
            </div>
            <h2
              className={`text-2xl font-bold mb-2 ${
                hud.finished.extracted ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {hud.finished.extracted ? '任務達成 · 成功撤離戰區' : '行動失敗 · 特戰幹員陣亡'}
            </h2>
            <p className="text-sm text-slate-300 mb-6">
              使用裝備：{hud.finished.weaponName} · 任務歷時 {hud.finished.durationSec} 秒
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-[#0B0E11] border border-white/10 rounded p-3">
                <div className="text-[11px] text-slate-400">肅清敵軍</div>
                <div className="text-xl font-bold font-mono-tabular text-white mt-0.5">
                  {hud.finished.eliminations}
                </div>
              </div>
              <div className="bg-[#0B0E11] border border-white/10 rounded p-3">
                <div className="text-[11px] text-slate-400">精準爆頭</div>
                <div className="text-xl font-bold font-mono-tabular text-amber-400 mt-0.5">
                  {hud.finished.headshots}
                </div>
              </div>
              <div className="bg-[#0B0E11] border border-white/10 rounded p-3">
                <div className="text-[11px] text-slate-400">彈道命中率</div>
                <div className="text-xl font-bold font-mono-tabular text-white mt-0.5">
                  {hud.finished.shotsFired > 0
                    ? Math.round((hud.finished.shotsHit / hud.finished.shotsFired) * 100)
                    : 0}
                  %
                </div>
              </div>
              <div className="bg-[#0B0E11] border border-white/10 rounded p-3">
                <div className="text-[11px] text-slate-400">加密情報</div>
                <div className="text-xl font-bold font-mono-tabular text-emerald-400 mt-0.5">
                  {hud.finished.intelCollected}/{hud.finished.intelTotal}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => actionsRef.current.forceRestart()}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-md transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                再次部署實戰
              </button>
              <button
                type="button"
                onClick={onExit}
                className="flex-1 px-5 py-2.5 text-sm font-medium bg-[#1C222B] hover:bg-[#252C38] text-white border border-white/10 rounded-md transition-colors whitespace-nowrap"
              >
                返回改裝工坊
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WebGL Context Lost Fallback */}
      {hud.contextLost && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0B0E11] p-6 text-center">
          <div className="max-w-md">
            <h3 className="text-lg font-bold text-white mb-2">3D 渲染內容暫時中斷</h3>
            <p className="text-sm text-slate-400 mb-4">
              瀏覽器正在恢復圖形資源，請點擊重新載入或返回基地頁面。
            </p>
            <button
              type="button"
              onClick={onExit}
              className="px-4 py-2 text-sm font-semibold bg-amber-500 text-slate-950 rounded-md"
            >
              返回基地
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
