import * as THREE from 'three';
import { LoadoutConfig, MapId } from '../types/tactical';

export interface ProceduralTextureSet {
  concreteMap: THREE.CanvasTexture;
  terrainMap: THREE.CanvasTexture;
  containerOliveMap: THREE.CanvasTexture;
  containerRustMap: THREE.CanvasTexture;
  helipadMap: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function configureTexture(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(
  maxAnisotropy: number,
  mapId: MapId
): ProceduralTextureSet {
  // 1. Concrete & tarmac texture
  const [concCanvas, concCtx] = makeCanvas(512, 512);
  concCtx.fillStyle = mapId === 'zero_dam' ? '#3d4247' : '#5e564a';
  concCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 45 + Math.floor(Math.random() * 35);
    concCtx.fillStyle = `rgba(${v},${v},${v},0.32)`;
    concCtx.fillRect(x, y, 2, 2);
  }
  concCtx.strokeStyle = 'rgba(15, 18, 22, 0.35)';
  concCtx.lineWidth = 2;
  for (let g = 0; g <= 512; g += 128) {
    concCtx.beginPath();
    concCtx.moveTo(g, 0);
    concCtx.lineTo(g, 512);
    concCtx.stroke();
    concCtx.beginPath();
    concCtx.moveTo(0, g);
    concCtx.lineTo(512, g);
    concCtx.stroke();
  }
  const concreteMap = configureTexture(concCanvas, maxAnisotropy, 2, 2);

  // 2. Ground terrain texture
  const [terrCanvas, terrCtx] = makeCanvas(512, 512);
  terrCtx.fillStyle = mapId === 'zero_dam' ? '#33383d' : '#7b6c55';
  terrCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 7000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const size = 1 + Math.random() * 3;
    const shade = mapId === 'zero_dam' ? 40 + Math.random() * 30 : 95 + Math.random() * 45;
    terrCtx.fillStyle =
      mapId === 'zero_dam'
        ? `rgba(${shade}, ${shade + 3}, ${shade + 5}, 0.28)`
        : `rgba(${shade + 15}, ${shade}, ${shade - 22}, 0.3)`;
    terrCtx.fillRect(x, y, size, size);
  }
  terrCtx.strokeStyle = 'rgba(255,255,255,0.035)';
  terrCtx.lineWidth = 1;
  for (let g = 0; g < 512; g += 64) {
    terrCtx.beginPath();
    terrCtx.moveTo(g, 0);
    terrCtx.lineTo(g, 512);
    terrCtx.stroke();
    terrCtx.beginPath();
    terrCtx.moveTo(0, g);
    terrCtx.lineTo(512, g);
    terrCtx.stroke();
  }
  const terrainMap = configureTexture(terrCanvas, maxAnisotropy, 18, 18);

  // 3. Corrugated shipping container (Olive & Industrial Rust)
  const buildContainerTex = (baseHex: string, stripeHex: string) => {
    const [c, ctx] = makeCanvas(512, 256);
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 512, 256);
    for (let x = 0; x < 512; x += 16) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x, 0, 6, 256);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x + 6, 0, 3, 256);
    }
    ctx.fillStyle = stripeHex;
    ctx.fillRect(0, 18, 512, 10);
    ctx.fillRect(0, 228, 512, 10);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = 'rgba(20, 15, 10, 0.16)';
      ctx.fillRect(Math.random() * 512, Math.random() * 256, 3, 3);
    }
    return configureTexture(c, maxAnisotropy, 1, 1);
  };
  const containerOliveMap = buildContainerTex('#3c4738', '#d97706');
  const containerRustMap = buildContainerTex('#5b3a2e', '#9ca3af');

  // 4. Helipad marking texture
  const [heliCanvas, heliCtx] = makeCanvas(512, 512);
  heliCtx.fillStyle = '#25292e';
  heliCtx.fillRect(0, 0, 512, 512);
  heliCtx.strokeStyle = '#f59e0b';
  heliCtx.lineWidth = 14;
  heliCtx.beginPath();
  heliCtx.arc(256, 256, 210, 0, Math.PI * 2);
  heliCtx.stroke();

  heliCtx.strokeStyle = '#e5e7eb';
  heliCtx.lineWidth = 6;
  heliCtx.setLineDash([22, 14]);
  heliCtx.beginPath();
  heliCtx.arc(256, 256, 175, 0, Math.PI * 2);
  heliCtx.stroke();
  heliCtx.setLineDash([]);

  heliCtx.fillStyle = '#f59e0b';
  heliCtx.fillRect(176, 146, 32, 220);
  heliCtx.fillRect(304, 146, 32, 220);
  heliCtx.fillRect(176, 240, 160, 32);
  const helipadMap = configureTexture(heliCanvas, maxAnisotropy, 1, 1);

  return {
    concreteMap,
    terrainMap,
    containerOliveMap,
    containerRustMap,
    helipadMap,
    dispose: () => {
      concreteMap.dispose();
      terrainMap.dispose();
      containerOliveMap.dispose();
      containerRustMap.dispose();
      helipadMap.dispose();
    },
  };
}

export function createViewmodelWeapon(
  loadout: LoadoutConfig,
  slot: 'primary' | 'sidearm'
): THREE.Group {
  const group = new THREE.Group();

  const receiverMat = new THREE.MeshStandardMaterial({
    color: slot === 'primary' && loadout.weaponId === 'awm' ? 0x3b4434 : 0x1e2228,
    roughness: 0.34,
    metalness: 0.84,
  });
  const polymerMat = new THREE.MeshStandardMaterial({
    color: slot === 'primary' && loadout.weaponId === 'm4a1' ? 0x6f614d : 0x16181c,
    roughness: 0.78,
    metalness: 0.12,
  });
  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x14171c,
    roughness: 0.22,
    metalness: 0.92,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.4,
    metalness: 0.6,
  });

  if (slot === 'sidearm') {
    // Tactical 9mm pistol (6 composite parts)
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.046, 0.24), barrelMat);
    slide.position.set(0, 0.024, -0.02);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.03, 0.21), polymerMat);
    frame.position.set(0, -0.008, -0.008);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.12, 0.055), polymerMat);
    grip.position.set(0, -0.072, 0.068);
    grip.rotation.x = 0.22;
    const muzzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.11, 14),
      barrelMat
    );
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.02, -0.185);
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.01, 0.008), accentMat);
    frontSight.position.set(0, 0.052, -0.125);
    const magBase = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.014, 0.058), receiverMat);
    magBase.position.set(0, -0.132, 0.082);

    group.add(slide, frame, grip, muzzle, frontSight, magBase);
    return group;
  }

  const isSniper = loadout.weaponId === 'awm';
  const isSmg = loadout.weaponId === 'mp5sd';
  const isAk = loadout.weaponId === 'ak12';

  const bodyLen = isSniper ? 0.52 : isSmg ? 0.34 : 0.42;
  const barrelLen = isSniper ? 0.46 : isSmg ? 0.22 : 0.32;

  // 1. Upper & lower receiver
  const receiver = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.072, bodyLen),
    receiverMat
  );
  receiver.position.set(0, 0, 0);

  // 2. Picatinny top rail
  const topRail = new THREE.Mesh(
    new THREE.BoxGeometry(0.034, 0.016, bodyLen * 0.92),
    barrelMat
  );
  topRail.position.set(0, 0.044, -0.01);

  // 3. Handguard / forend
  const handguard = new THREE.Mesh(
    new THREE.BoxGeometry(0.048, 0.056, bodyLen * 0.65),
    polymerMat
  );
  handguard.position.set(0, 0.002, -bodyLen * 0.65);

  // 4. Precision barrel
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.014, barrelLen, 14),
    barrelMat
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.01, -bodyLen * 0.65 - barrelLen * 0.48);

  // 5. Pistol grip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.13, 0.052), polymerMat);
  grip.position.set(0, -0.085, bodyLen * 0.26);
  grip.rotation.x = 0.24;

  // 6. Tactical buttstock
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.095, 0.22), polymerMat);
  stock.position.set(0, -0.018, bodyLen * 0.62);

  // 7. Vertical foregrip
  const foregrip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.014, 0.095, 12),
    polymerMat
  );
  foregrip.position.set(0, -0.068, -bodyLen * 0.68);

  // 8. Magazine (standard vs extended)
  const magHeight = loadout.magazineId === 'ext_mag' ? 0.22 : 0.15;
  const mag = new THREE.Mesh(
    new THREE.BoxGeometry(0.034, magHeight, isSmg ? 0.042 : 0.068),
    isAk ? polymerMat : barrelMat
  );
  mag.position.set(0, -0.04 - magHeight * 0.45, -bodyLen * 0.08);
  mag.rotation.x = isAk ? -0.22 : -0.1;

  group.add(receiver, topRail, handguard, barrel, grip, stock, foregrip, mag);

  // 9. Muzzle device (Suppressor / Brake / Standard)
  const muzzleZ = -bodyLen * 0.65 - barrelLen * 0.96;
  if (loadout.muzzleId === 'suppressor' || isSmg) {
    const suppressor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, 0.21, 16),
      barrelMat
    );
    suppressor.rotation.x = Math.PI / 2;
    suppressor.position.set(0, 0.01, muzzleZ - 0.07);
    group.add(suppressor);
  } else if (loadout.muzzleId === 'brake') {
    const brake = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.032, 0.075), receiverMat);
    brake.position.set(0, 0.01, muzzleZ - 0.02);
    group.add(brake);
  }

  // 10. Optic attachment (Iron / Red Dot / 2.5x ACOG)
  if (loadout.opticId === 'iron') {
    const rearPost = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.024, 0.022), barrelMat);
    rearPost.position.set(0, 0.062, bodyLen * 0.25);
    const frontPost = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.026, 0.014), accentMat);
    frontPost.position.set(0, 0.062, -bodyLen * 0.85);
    group.add(rearPost, frontPost);
  } else if (loadout.opticId === 'red_dot') {
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.042, 0.075), barrelMat);
    housing.position.set(0, 0.072, 0.02);
    const lensMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.22,
    });
    const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.032, 0.026), lensMat);
    lens.position.set(0, 0.074, 0.059);
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.0028, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    dot.position.set(0, 0.074, 0.02);
    group.add(housing, lens, dot);
  } else {
    const scopeTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.022, 0.16, 16),
      barrelMat
    );
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.078, 0.01);
    const scopeMount = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.03, 0.09), receiverMat);
    scopeMount.position.set(0, 0.058, 0.01);
    const opticRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.022, 0.003, 8, 16),
      accentMat
    );
    opticRim.position.set(0, 0.078, 0.09);
    group.add(scopeTube, scopeMount, opticRim);
  }

  return group;
}

export function createEnemyOperator(elite: boolean): {
  group: THREE.Group;
  headMesh: THREE.Mesh;
  bodyMesh: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
} {
  const group = new THREE.Group();

  const uniformMat = new THREE.MeshStandardMaterial({
    color: elite ? 0x26292e : 0x3b4238,
    roughness: 0.82,
    metalness: 0.08,
  });
  const armorMat = new THREE.MeshStandardMaterial({
    color: elite ? 0x17191c : 0x2d312a,
    roughness: 0.48,
    metalness: 0.35,
  });
  const gearMat = new THREE.MeshStandardMaterial({
    color: 0x111317,
    roughness: 0.3,
    metalness: 0.85,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: elite ? 0xef4444 : 0xf59e0b,
    emissive: elite ? 0xef4444 : 0xd97706,
    emissiveIntensity: 1.4,
    roughness: 0.2,
    metalness: 0.5,
  });

  // Grounded at y = 0 (feet bottom = 0)
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.82, 0.22), uniformMat);
  leftLeg.position.set(-0.14, 0.41, 0);
  leftLeg.castShadow = true;

  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.82, 0.22), uniformMat);
  rightLeg.position.set(0.14, 0.41, 0);
  rightLeg.castShadow = true;

  // Armored Torso (Primary body hitbox)
  const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.64, 0.3), armorMat);
  bodyMesh.position.set(0, 1.14, 0);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.userData.hitbox = 'body';

  // Chest rig pouches
  const rig = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.34), uniformMat);
  rig.position.set(0, 1.12, 0.02);
  rig.userData.hitbox = 'body';

  // Backpack radio unit
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.16), armorMat);
  pack.position.set(0, 1.18, -0.2);

  // Shoulder pads
  const leftShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.22), armorMat);
  leftShoulder.position.set(-0.34, 1.32, 0);
  const rightShoulder = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.22), armorMat);
  rightShoulder.position.set(0.34, 1.32, 0);

  // Arms holding tactical rifle
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.46, 0.14), uniformMat);
  leftArm.position.set(-0.3, 1.08, 0.18);
  leftArm.rotation.x = -0.9;

  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.46, 0.14), uniformMat);
  rightArm.position.set(0.28, 1.06, 0.16);
  rightArm.rotation.x = -1.05;

  // Enemy rifle
  const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.72), gearMat);
  rifle.position.set(0.12, 1.1, 0.42);

  // Ballistic Helmet (Head hitbox)
  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.32), armorMat);
  headMesh.position.set(0, 1.63, 0);
  headMesh.castShadow = true;
  headMesh.userData.hitbox = 'head';

  // Glowing tactical visor
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.04), visorMat);
  visor.position.set(0, 1.64, 0.16);
  visor.userData.hitbox = 'head';

  group.add(
    leftLeg,
    rightLeg,
    bodyMesh,
    rig,
    pack,
    leftShoulder,
    rightShoulder,
    leftArm,
    rightArm,
    rifle,
    headMesh,
    visor
  );

  return { group, headMesh, bodyMesh, leftLeg, rightLeg };
}

export function createShippingContainer(
  tex: THREE.CanvasTexture,
  width = 2.6,
  height = 2.7,
  depth = 6.2
): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.65,
    metalness: 0.45,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x1c2024,
    roughness: 0.4,
    metalness: 0.8,
  });

  const mainBox = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), bodyMat);
  mainBox.position.y = height / 2;
  mainBox.castShadow = true;
  mainBox.receiveShadow = true;

  const topFrame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.08, 0.12, depth + 0.08), frameMat);
  topFrame.position.y = height - 0.06;

  const baseFrame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.08, 0.12, depth + 0.08), frameMat);
  baseFrame.position.y = 0.06;

  group.add(mainBox, topFrame, baseFrame);
  return group;
}

export function createJerseyBarrier(concreteMap: THREE.CanvasTexture, length = 3.2): THREE.Group {
  const group = new THREE.Group();
  const concMat = new THREE.MeshStandardMaterial({
    map: concreteMap,
    roughness: 0.88,
    metalness: 0.05,
  });
  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.55,
    metalness: 0.15,
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(length, 0.42, 0.85), concMat);
  base.position.y = 0.21;
  base.castShadow = true;
  base.receiveShadow = true;

  const upper = new THREE.Mesh(new THREE.BoxGeometry(length, 0.72, 0.42), concMat);
  upper.position.y = 0.78;
  upper.castShadow = true;
  upper.receiveShadow = true;

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(length * 0.85, 0.1, 0.44), stripeMat);
  stripe.position.y = 0.96;

  group.add(base, upper, stripe);
  return group;
}

export function createSandbagBunker(length = 3.4): THREE.Group {
  const group = new THREE.Group();
  const bagMat = new THREE.MeshStandardMaterial({
    color: 0x8b7b5e,
    roughness: 0.92,
    metalness: 0.02,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x4b3a29,
    roughness: 0.85,
    metalness: 0.05,
  });

  for (let row = 0; row < 3; row++) {
    const count = 4;
    for (let i = 0; i < count; i++) {
      const bag = new THREE.Mesh(
        new THREE.BoxGeometry(length / count - 0.05, 0.34, 0.62 - row * 0.05),
        bagMat
      );
      bag.position.set(
        -length / 2 + (i + 0.5) * (length / count) + (row % 2 === 0 ? 0.05 : -0.05),
        0.17 + row * 0.33,
        0
      );
      bag.castShadow = true;
      bag.receiveShadow = true;
      group.add(bag);
    }
  }

  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.12, 0.14), woodMat);
  postL.position.set(-length / 2, 0.56, 0.26);
  const postR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.12, 0.14), woodMat);
  postR.position.set(length / 2, 0.56, 0.26);
  group.add(postL, postR);

  return group;
}

export function createIntelCrate(): { group: THREE.Group; beaconRing: THREE.Mesh } {
  const group = new THREE.Group();
  const caseMat = new THREE.MeshStandardMaterial({
    color: 0x1f242b,
    roughness: 0.38,
    metalness: 0.72,
  });
  const latchMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.8,
    roughness: 0.25,
    metalness: 0.6,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.44, 0.56), caseMat);
  body.position.y = 0.22;
  body.castShadow = true;

  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.1, 0.6), caseMat);
  lid.position.y = 0.46;

  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.06, 0.62), latchMat);
  strip.position.y = 0.46;

  const beaconRing = new THREE.Mesh(
    new THREE.RingGeometry(0.65, 0.78, 24),
    new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    })
  );
  beaconRing.rotation.x = -Math.PI / 2;
  beaconRing.position.y = 0.03;

  group.add(body, lid, strip, beaconRing);
  return { group, beaconRing };
}

export function createExtractionPad(helipadMap: THREE.CanvasTexture): {
  group: THREE.Group;
  beaconBeam: THREE.Mesh;
} {
  const group = new THREE.Group();
  const padMat = new THREE.MeshStandardMaterial({
    map: helipadMap,
    roughness: 0.75,
    metalness: 0.12,
  });
  const pad = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.18, 8.5), padMat);
  pad.position.y = 0.09;
  pad.receiveShadow = true;

  const lightMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 1.5,
  });

  const corners: [number, number][] = [
    [-4.1, -4.1],
    [4.1, -4.1],
    [-4.1, 4.1],
    [4.1, 4.1],
  ];
  corners.forEach(([cx, cz]) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.42, 10), lightMat);
    post.position.set(cx, 0.21, cz);
    group.add(post);
  });

  const beaconBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.85, 16, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  beaconBeam.position.y = 8.1;
  group.add(pad, beaconBeam);

  return { group, beaconBeam };
}

export function createRadarTower(): { group: THREE.Group; dish: THREE.Group } {
  const group = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x4b5563,
    roughness: 0.45,
    metalness: 0.78,
  });
  const dishMat = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    roughness: 0.35,
    metalness: 0.4,
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 3.2), steelMat);
  base.position.y = 0.6;
  base.castShadow = true;

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.55, 11, 8), steelMat);
  mast.position.y = 6.7;
  mast.castShadow = true;

  const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.2, 0.35, 12), steelMat);
  platform.position.y = 12.2;

  const dishGroup = new THREE.Group();
  dishGroup.position.set(0, 13.4, 0);

  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 0.4, 0.65, 16),
    dishMat
  );
  bowl.rotation.x = Math.PI / 3;
  const feedHorn = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 8), steelMat);
  feedHorn.rotation.x = Math.PI / 3;
  feedHorn.position.set(0, 0.35, 0.45);

  dishGroup.add(bowl, feedHorn);
  group.add(base, mast, platform, dishGroup);
  return { group, dish: dishGroup };
}
