import * as THREE from 'three';
import { getGameTextures } from './textures';

export type ObstacleKind =
  | 'sedan'
  | 'police'
  | 'bus'
  | 'motorcycle'
  | 'hole'
  | 'barrier_low'
  | 'crates'
  | 'slide_arch'
  | 'truck_slide';

export interface ObstacleItem {
  id: number;
  kind: ObstacleKind;
  mesh: THREE.Group;
  z: number;
  x: number;
  halfWidth: number;
  halfLength: number;
  /** Maximum height of solid part from ground (if >0, player jumping above this clears it) */
  topY: number;
  /** Minimum height of solid part from ground (if >1.0, sliding player passes underneath!) */
  bottomY: number;
  /** Whether it's a road pit that requires jumping */
  isHole: boolean;
  /** Optional moving velocity along X or Z */
  vx: number;
  vz: number;
  isMinor: boolean;
  hitAlready: boolean;
  crushedByCan: boolean;
}

export interface CollectibleCan {
  id: number;
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  collected: boolean;
}

export interface CheckpointGate {
  index: number;
  z: number;
  mesh: THREE.Group;
  flagMat: THREE.MeshStandardMaterial;
  reached: boolean;
}

export interface SidewalkNPC {
  mesh: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  baseZ: number;
  x: number;
  speedZ: number;
  phase: number;
}

export interface StageConfig {
  id: number;
  code: string;
  titleFa: string;
  subtitleFa: string;
  skyColor: number;
  fogColor: number;
  groundColor: number;
  length: number;
  chaseStartZ: number;
  chaseEndZ: number;
  checkpoints: number[];
  timeLimit: number;
  baseSpeed: number;
  chaseSpeed: number;
}

export const STAGES: StageConfig[] = [
  {
    id: 1,
    code: '۱ - ۱',
    titleFa: 'محله مسکونی',
    subtitleFa: 'خانه‌ها، خیابان‌ها، درختان و تعقیب قوطی غول‌پیکر',
    skyColor: 0x38bdf8,
    fogColor: 0xbae6fd,
    groundColor: 0x228b22,
    length: 1120,
    chaseStartZ: 610,
    chaseEndZ: 990,
    checkpoints: [310, 595, 1000],
    timeLimit: 85,
    baseSpeed: 21,
    chaseSpeed: 26.5,
  },
  {
    id: 2,
    code: '۱ - ۲',
    titleFa: 'شهر بزرگ',
    subtitleFa: 'ترافیک سنگین، مغازه‌ها، تقاطع‌ها و کامیون نوشابه',
    skyColor: 0x2563eb,
    fogColor: 0x93c5fd,
    groundColor: 0x475569,
    length: 1220,
    chaseStartZ: 650,
    chaseEndZ: 1080,
    checkpoints: [330, 635, 1090],
    timeLimit: 90,
    baseSpeed: 23,
    chaseSpeed: 28.5,
  },
  {
    id: 3,
    code: '۱ - ۳',
    titleFa: 'جاده حومه',
    subtitleFa: 'بزرگراه بیابانی، کارگاه‌های راه‌سازی و پرش‌های بلند',
    skyColor: 0xf97316,
    fogColor: 0xfed7aa,
    groundColor: 0xd97706,
    length: 1320,
    chaseStartZ: 690,
    chaseEndZ: 1180,
    checkpoints: [350, 675, 1190],
    timeLimit: 92,
    baseSpeed: 24.5,
    chaseSpeed: 30,
  },
  {
    id: 4,
    code: '۱ - ۴',
    titleFa: 'شهر نوشابه FIZZ-X',
    subtitleFa: 'کارخانه عظیم نوشابه، لوله‌های صنعتی و فرار نهایی',
    skyColor: 0x1e1b4b,
    fogColor: 0x312e81,
    groundColor: 0x1e293b,
    length: 1420,
    chaseStartZ: 720,
    chaseEndZ: 1280,
    checkpoints: [370, 705, 1290],
    timeLimit: 95,
    baseSpeed: 26,
    chaseSpeed: 31.5,
  },
];

export const LANES = [-3.1, 0, 3.1];

export interface BuiltStageWorld {
  worldGroup: THREE.Group;
  obstacles: ObstacleItem[];
  collectibles: CollectibleCan[];
  checkpoints: CheckpointGate[];
  npcs: SidewalkNPC[];
  giantCanGroup: THREE.Group;
  giantCanCylinder: THREE.Mesh;
}

export function buildStageWorld(stage: StageConfig): BuiltStageWorld {
  const textures = getGameTextures();
  const worldGroup = new THREE.Group();
  const obstacles: ObstacleItem[] = [];
  const collectibles: CollectibleCan[] = [];
  const checkpoints: CheckpointGate[] = [];
  const npcs: SidewalkNPC[] = [];

  // Repeat road texture along stage length
  const roadTex = textures.roadAsphalt.clone();
  roadTex.needsUpdate = true;
  roadTex.repeat.set(1, Math.floor((stage.length + 250) / 14));

  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTex,
    roughness: 0.85,
    metalness: 0.05,
  });

  const roadGeo = new THREE.PlaneGeometry(11, stage.length + 260);
  roadGeo.rotateX(-Math.PI / 2);
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.position.set(0, 0, (stage.length + 120) / 2 - 40);
  worldGroup.add(roadMesh);

  // Sidewalks on Left (+X) and Right (-X)
  const swTex = textures.sidewalkTile.clone();
  swTex.needsUpdate = true;
  swTex.repeat.set(1, Math.floor((stage.length + 250) / 8));
  const swMat = new THREE.MeshStandardMaterial({ map: swTex, roughness: 0.8 });

  for (const side of [-1, 1]) {
    const swGeo = new THREE.BoxGeometry(2.6, 0.22, stage.length + 260);
    const swMesh = new THREE.Mesh(swGeo, swMat);
    swMesh.position.set(side * 6.8, 0.11, (stage.length + 120) / 2 - 40);
    worldGroup.add(swMesh);

    // Outer ground / grass / canyon / factory floor
    const groundMat = new THREE.MeshStandardMaterial({
      color: stage.groundColor,
      map: stage.id === 1 ? textures.grassLawn : undefined,
      roughness: 0.9,
    });
    const outGeo = new THREE.PlaneGeometry(46, stage.length + 260);
    outGeo.rotateX(-Math.PI / 2);
    const outMesh = new THREE.Mesh(outGeo, groundMat);
    outMesh.position.set(side * 31, 0.01, (stage.length + 120) / 2 - 40);
    worldGroup.add(outMesh);
  }

  // ==========================================================
  // ROADSIDE BUILDINGS, TREES, FENCES, STREETLIGHTS, NPCS
  // ==========================================================
  const houseWalls = [textures.suburbanWallBlue, textures.suburbanWallCream, textures.suburbanWallBrick];
  const roofColors = [0x991b1b, 0x1e3a8a, 0x3f3f46, 0x7c2d12];
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, flatShading: true });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, flatShading: true });
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  for (let z = -10; z < stage.length + 90; z += 24) {
    for (const side of [-1, 1]) {
      const xBase = side * 14.5;

      if (stage.id === 1) {
        // Suburban House with Roof, Garage, and White Picket Fence
        const wallTex = houseWalls[Math.abs(Math.floor(z + side * 7)) % houseWalls.length];
        const houseGroup = new THREE.Group();
        houseGroup.position.set(xBase, 0, z);

        const body = new THREE.Mesh(
          new THREE.BoxGeometry(8.5, 5.4, 9.5),
          new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.7 })
        );
        body.position.y = 2.7;
        houseGroup.add(body);

        // Pitched Roof
        const roofGeo = new THREE.ConeGeometry(7.2, 3.2, 4);
        roofGeo.rotateY(Math.PI / 4);
        const roof = new THREE.Mesh(
          roofGeo,
          new THREE.MeshStandardMaterial({
            color: roofColors[Math.abs(Math.floor(z / 24)) % roofColors.length],
            flatShading: true,
          })
        );
        roof.position.y = 6.9;
        houseGroup.add(roof);

        // White front fence along yard
        const fence = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.1, 16), fenceMat);
        fence.position.set(-side * 5.2, 0.55, 0);
        houseGroup.add(fence);

        worldGroup.add(houseGroup);

        // Lush Low-Poly Tree in front yard
        const treeGroup = new THREE.Group();
        treeGroup.position.set(side * 10.2, 0, z + 9);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 2.4, 6), trunkMat);
        trunk.position.y = 1.2;
        treeGroup.add(trunk);
        const crown1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.85, 0), foliageMat);
        crown1.position.y = 3.2;
        treeGroup.add(crown1);
        const crown2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.35, 0), foliageMat);
        crown2.position.set(0, 4.5, 0);
        treeGroup.add(crown2);
        worldGroup.add(treeGroup);
      } else if (stage.id === 2) {
        // Dense Urban City Buildings & Billboards
        const h = 14 + ((Math.abs(z * 3 + side * 11) % 5) * 4);
        const bldg = new THREE.Mesh(
          new THREE.BoxGeometry(10, h, 14),
          new THREE.MeshStandardMaterial({ map: textures.cityBuildingGlass, roughness: 0.5 })
        );
        bldg.position.set(xBase, h / 2, z);
        worldGroup.add(bldg);

        if (z % 48 === 0) {
          const board = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 3.6, 7.2),
            new THREE.MeshBasicMaterial({ map: textures.fizzBillboard })
          );
          board.position.set(side * 9.2, 6.5, z);
          worldGroup.add(board);
        }
      } else if (stage.id === 3) {
        // Highway Desert Canyon Cliffs & Cacti
        const cliffH = 9 + ((z * 7) % 12);
        const cliff = new THREE.Mesh(
          new THREE.ConeGeometry(8.5, cliffH, 6),
          new THREE.MeshStandardMaterial({ color: 0xb45309, flatShading: true })
        );
        cliff.position.set(side * 18, cliffH / 2, z);
        worldGroup.add(cliff);

        // Giant cactus
        const cactus = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 3.8, 7), foliageMat);
        cactus.position.set(side * 9.8, 1.9, z + 6);
        worldGroup.add(cactus);
      } else {
        // Stage 4: FIZZ-X Industrial Soda City (Giant Soda Tanks & Factory Halls)
        const tank = new THREE.Mesh(
          new THREE.CylinderGeometry(3.8, 3.8, 12, 14),
          new THREE.MeshStandardMaterial({ map: textures.fizzCanSide, metalness: 0.6, roughness: 0.3 })
        );
        tank.position.set(xBase, 6, z);
        worldGroup.add(tank);
      }

      // Streetlights & Hydrants / Trash Cans on Sidewalks
      const lampGroup = new THREE.Group();
      lampGroup.position.set(side * 5.9, 0, z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.2, 6), poleMat);
      pole.position.y = 2.6;
      lampGroup.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.12), poleMat);
      arm.position.set(-side * 0.6, 5.1, 0);
      lampGroup.add(arm);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), bulbMat);
      bulb.position.set(-side * 1.15, 4.95, 0);
      lampGroup.add(bulb);
      worldGroup.add(lampGroup);

      // Fire Hydrant or Trash Can on sidewalk outer edge
      if (z % 48 === 0) {
        const hydrant = new THREE.Mesh(
          new THREE.CylinderGeometry(0.2, 0.24, 0.75, 8),
          new THREE.MeshStandardMaterial({ color: 0xdc2626, flatShading: true })
        );
        hydrant.position.set(side * 6.2, 0.55, z + 6);
        worldGroup.add(hydrant);
      }
    }
  }

  // ==========================================================
  // LOW-POLY ANIMATED SIDEWALK NPCS
  // ==========================================================
  const shirtColors = [0xef4444, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xec4899, 0x06b6d4];
  for (let z = 35; z < stage.length - 40; z += 45) {
    const side = (Math.floor(z / 45) % 2 === 0 ? 1 : -1) as -1 | 1;
    const npcGroup = new THREE.Group();
    const xPos = side * 6.9;
    npcGroup.position.set(xPos, 0.22, z);

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfcd34d, flatShading: true });
    const shirtMat = new THREE.MeshStandardMaterial({
      color: shirtColors[Math.floor(z) % shirtColors.length],
      flatShading: true,
    });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, flatShading: true });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.56, 0.24), shirtMat);
    torso.position.y = 0.95;
    npcGroup.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), skinMat);
    head.position.y = 1.42;
    npcGroup.add(head);

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.18), pantsMat);
    leftLeg.position.set(-0.11, 0.35, 0);
    npcGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.18), pantsMat);
    rightLeg.position.set(0.11, 0.35, 0);
    npcGroup.add(rightLeg);

    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 0.14), shirtMat);
    leftArm.position.set(-0.3, 0.92, 0);
    npcGroup.add(leftArm);

    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.5, 0.14), shirtMat);
    rightArm.position.set(0.3, 0.92, 0);
    npcGroup.add(rightArm);

    worldGroup.add(npcGroup);
    npcs.push({
      mesh: npcGroup,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      baseZ: z,
      x: xPos,
      speedZ: side * 2.4,
      phase: z * 0.3,
    });
  }

  // ==========================================================
  // HELPER FUNCTIONS FOR OBSTACLES & COLLECTIBLE CANS
  // ==========================================================
  let nextObstacleId = 1;
  let nextCanId = 1;

  const canGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.78, 12);
  const canSideMat = new THREE.MeshStandardMaterial({
    map: textures.fizzCanSide,
    metalness: 0.65,
    roughness: 0.25,
  });
  const canTopMat = new THREE.MeshStandardMaterial({
    map: textures.fizzCanTop,
    metalness: 0.8,
    roughness: 0.2,
  });

  function spawnCan(x: number, y: number, z: number) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const mesh = new THREE.Mesh(canGeo, [canSideMat, canTopMat, canTopMat]);
    mesh.rotation.z = 0.18;
    group.add(mesh);
    worldGroup.add(group);
    collectibles.push({
      id: nextCanId++,
      mesh: group,
      x,
      y,
      z,
      collected: false,
    });
  }

  function createCarMesh(color: number, isPolice: boolean = false): THREE.Group {
    const car = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.4, metalness: 0.3 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.8 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.2), bodyMat);
    chassis.position.y = 0.52;
    car.add(chassis);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.52, 2.2), isPolice ? new THREE.MeshStandardMaterial({ color: 0xffffff }) : bodyMat);
    cabin.position.set(0, 1.02, -0.15);
    car.add(cabin);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.42, 2.26), glassMat);
    windshield.position.set(0, 1.0, -0.15);
    car.add(windshield);

    // Headlights
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    for (const sx of [-0.7, 0.7]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), lightMat);
      hl.position.set(sx, 0.55, 2.11);
      car.add(hl);
    }

    if (isPolice) {
      const redBar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.25), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      redBar.position.set(-0.3, 1.35, -0.1);
      car.add(redBar);
      const blueBar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.25), new THREE.MeshBasicMaterial({ color: 0x3b82f6 }));
      blueBar.position.set(0.3, 1.35, -0.1);
      car.add(blueBar);
    }

    // 4 Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    for (const wx of [-1.02, 1.02]) {
      for (const wz of [-1.25, 1.25]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.position.set(wx, 0.34, wz);
        car.add(w);
      }
    }
    return car;
  }

  function createBusMesh(): THREE.Group {
    const bus = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.45, 2.4, 6.8),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 })
    );
    body.position.y = 1.45;
    bus.add(body);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.55, 6.85),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a })
    );
    stripe.position.y = 1.4;
    bus.add(stripe);
    return bus;
  }

  function createHoleMesh(width: number): THREE.Group {
    const hole = new THREE.Group();
    // Deep dark pit rectangle on asphalt
    const pitGeo = new THREE.BoxGeometry(width, 0.08, 3.6);
    const pitMat = new THREE.MeshBasicMaterial({ color: 0x050507 });
    const pit = new THREE.Mesh(pitGeo, pitMat);
    pit.position.y = 0.02;
    hole.add(pit);

    // Orange/white hazard rim & traffic cones warning the player
    const rimMat = new THREE.MeshStandardMaterial({ map: textures.hazardStripes });
    const frontRim = new THREE.Mesh(new THREE.BoxGeometry(width + 0.3, 0.28, 0.28), rimMat);
    frontRim.position.set(0, 0.14, -1.85);
    hole.add(frontRim);

    const backRim = new THREE.Mesh(new THREE.BoxGeometry(width + 0.3, 0.28, 0.28), rimMat);
    backRim.position.set(0, 0.14, 1.85);
    hole.add(backRim);

    const coneMat = new THREE.MeshStandardMaterial({ color: 0xf97316, flatShading: true });
    for (const cx of [-width / 2, width / 2]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 8), coneMat);
      cone.position.set(cx, 0.38, -2.1);
      hole.add(cone);
    }
    return hole;
  }

  function createLowBarrierMesh(width: number): THREE.Group {
    const group = new THREE.Group();
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.45, 0.3),
      new THREE.MeshStandardMaterial({ map: textures.hazardStripes })
    );
    bar.position.y = 0.78;
    group.add(bar);

    const legMat = new THREE.MeshStandardMaterial({ color: 0xf97316 });
    for (const lx of [-width / 2 + 0.25, width / 2 - 0.25]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.0, 0.45), legMat);
      leg.position.set(lx, 0.5, 0);
      group.add(leg);
    }
    return group;
  }

  // MAJOR TRUCK SLIDE OBSTACLE (Spans across the road with a slide opening underneath!)
  function createTruckSlideObstacle(z: number) {
    const truckGroup = new THREE.Group();
    truckGroup.position.set(0, 0, z);

    // Huge Elevated FIZZ-X Trailer spanning across the 3 lanes (x from -4.8 to +4.8)
    // Bottom of trailer is at y = 1.32m -> Standing player (1.95m) hits it, Sliding player (0.7m) passes right underneath!
    const trailerMat = new THREE.MeshStandardMaterial({
      map: textures.truckTrailer,
      roughness: 0.4,
      metalness: 0.3,
    });
    const trailer = new THREE.Mesh(new THREE.BoxGeometry(9.6, 2.5, 2.8), trailerMat);
    trailer.position.set(0.4, 2.58, 0);
    truckGroup.add(trailer);

    // Yellow-black hazard bar along the bottom edge of the trailer so player sees exact slide clearance
    const clearanceBar = new THREE.Mesh(
      new THREE.BoxGeometry(8.2, 0.22, 2.86),
      new THREE.MeshStandardMaterial({ map: textures.hazardStripes })
    );
    clearanceBar.position.set(0, 1.42, 0);
    truckGroup.add(clearanceBar);

    // Semi-truck Tractor Cab on the left side (x = -5.4, outside the driving lanes)
    const cabMat = new THREE.MeshStandardMaterial({ color: 0x0047cc, roughness: 0.3, metalness: 0.5 });
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.9, 2.6), cabMat);
    cab.position.set(-5.6, 1.65, 0);
    truckGroup.add(cab);

    // Huge Truck Wheels located ONLY at the far left & far right edges outside the 3 lanes so the center road underneath is completely open for sliding!
    const wheelGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.55, 12);
    wheelGeo.rotateX(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827 });
    for (const wx of [-6.2, -4.6, 4.5, 5.3]) {
      for (const wz of [-1.1, 1.1]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.position.set(wx, 0.65, wz);
        truckGroup.add(w);
      }
    }

    worldGroup.add(truckGroup);

    obstacles.push({
      id: nextObstacleId++,
      kind: 'truck_slide',
      mesh: truckGroup,
      z,
      x: 0,
      halfWidth: 4.8,
      halfLength: 1.45,
      topY: 3.9,
      bottomY: 1.3, // Slide clears anything with bottomY >= 1.1!
      isHole: false,
      vx: 0,
      vz: 0,
      isMinor: false,
      hitAlready: false,
      crushedByCan: false,
    });

    // Trail of low soda cans right underneath the truck to guide the player into sliding!
    for (let dz = -6; dz <= 6; dz += 3) {
      spawnCan(0, 0.55, z + dz);
    }
  }

  // ==========================================================
  // POPULATE STAGE OBSTACLES & COLLECTIBLE SODA CANS
  // ==========================================================
  const carColors = [0xdc2626, 0x16a34a, 0x2563eb, 0x9333ea, 0xeab308, 0xf97316];

  for (let z = 55; z < stage.length - 45; z += 26) {
    // Keep checkpoint zones and chase transition trigger zone clear
    const nearCheckpoint = stage.checkpoints.some((cp) => Math.abs(z - cp) < 20);
    const nearChaseTrigger = Math.abs(z - stage.chaseStartZ) < 28;
    if (nearCheckpoint || nearChaseTrigger) {
      // Spawn celebratory can rows at checkpoints
      spawnCan(-3.1, 0.9, z);
      spawnCan(0, 0.9, z);
      spawnCan(3.1, 0.9, z);
      continue;
    }

    const inChase = z > stage.chaseStartZ && z < stage.chaseEndZ;
    const pattern = Math.floor(z / 26) % 9;

    // Include dedicated Truck Slide events both in normal stage AND during the Giant Can Chase!
    if (pattern === 4) {
      createTruckSlideObstacle(z);
      continue;
    }

    if (pattern === 2 || (inChase && pattern === 6)) {
      // Road Hole in 1 or 2 lanes — Player can jump over it (with a jump arc of cans!) or steer around
      const holeLane = LANES[Math.floor(z * 3) % 3];
      const holeMesh = createHoleMesh(2.9);
      holeMesh.position.set(holeLane, 0, z);
      worldGroup.add(holeMesh);

      obstacles.push({
        id: nextObstacleId++,
        kind: 'hole',
        mesh: holeMesh,
        z,
        x: holeLane,
        halfWidth: 1.35,
        halfLength: 1.55,
        topY: 0.2,
        bottomY: 0,
        isHole: true,
        vx: 0,
        vz: 0,
        isMinor: false,
        hitAlready: false,
        crushedByCan: false,
      });

      // Jump arc of collectible cans right over the hole!
      spawnCan(holeLane, 1.2, z - 3.5);
      spawnCan(holeLane, 2.25, z);
      spawnCan(holeLane, 1.2, z + 3.5);
    } else if (pattern === 0 || pattern === 5) {
      // Traffic Cars (Sedan or Police Car)
      const laneIdx = Math.floor(z * 7) % 3;
      const laneX = LANES[laneIdx];
      const isPolice = pattern === 5;
      const carMesh = createCarMesh(carColors[Math.floor(z) % carColors.length], isPolice);
      carMesh.position.set(laneX, 0, z);
      // Face oncoming (-Z) or parked
      carMesh.rotation.y = Math.PI;
      worldGroup.add(carMesh);

      obstacles.push({
        id: nextObstacleId++,
        kind: isPolice ? 'police' : 'sedan',
        mesh: carMesh,
        z,
        x: laneX,
        halfWidth: 1.05,
        halfLength: 2.0,
        topY: 1.25, // Player jump reaches 2.45m, so player can jump right over cars!
        bottomY: 0,
        isHole: false,
        vx: 0,
        vz: inChase ? 0 : -3.5,
        isMinor: false,
        hitAlready: false,
        crushedByCan: false,
      });

      // Cans in adjacent free lane + high jump can above the car!
      const freeLane = LANES[(laneIdx + 1) % 3];
      spawnCan(freeLane, 0.9, z - 4);
      spawnCan(freeLane, 0.9, z);
      spawnCan(freeLane, 0.9, z + 4);
      spawnCan(laneX, 2.35, z);
    } else if (pattern === 3 || pattern === 7) {
      // Low Construction Barrier + Red Crates/Barrels
      const laneIdx = Math.floor(z * 5) % 3;
      const laneX = LANES[laneIdx];
      const barMesh = createLowBarrierMesh(2.7);
      barMesh.position.set(laneX, 0, z);
      worldGroup.add(barMesh);

      obstacles.push({
        id: nextObstacleId++,
        kind: 'barrier_low',
        mesh: barMesh,
        z,
        x: laneX,
        halfWidth: 1.25,
        halfLength: 0.45,
        topY: 1.0,
        bottomY: 0,
        isHole: false,
        vx: 0,
        vz: 0,
        isMinor: true, // Minor collision stuns/slows instead of instant death!
        hitAlready: false,
        crushedByCan: false,
      });

      spawnCan(laneX, 2.05, z);
      const otherLane = LANES[(laneIdx + 2) % 3];
      spawnCan(otherLane, 0.9, z - 3);
      spawnCan(otherLane, 0.9, z + 3);
    } else {
      // Bus in one lane + low barrier in second lane + third lane open with cans
      const busLaneIdx = Math.floor(z) % 3;
      const busX = LANES[busLaneIdx];
      const busMesh = createBusMesh();
      busMesh.position.set(busX, 0, z);
      worldGroup.add(busMesh);

      obstacles.push({
        id: nextObstacleId++,
        kind: 'bus',
        mesh: busMesh,
        z,
        x: busX,
        halfWidth: 1.2,
        halfLength: 3.3,
        topY: 2.75,
        bottomY: 0,
        isHole: false,
        vx: 0,
        vz: 0,
        isMinor: false,
        hitAlready: false,
        crushedByCan: false,
      });

      const openLane = LANES[(busLaneIdx + 1) % 3];
      for (let dz = -5; dz <= 5; dz += 2.5) {
        spawnCan(openLane, 0.9, z + dz);
      }
    }
  }

  // ==========================================================
  // CHECKPOINT ARCHES & FINISH GATE
  // ==========================================================
  stage.checkpoints.forEach((cpZ, idx) => {
    const cpGroup = new THREE.Group();
    cpGroup.position.set(0, 0, cpZ);

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.5 });
    for (const sx of [-5.2, 5.2]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 5.5, 8), pillarMat);
      pillar.position.set(sx, 2.75, 0);
      cpGroup.add(pillar);
    }

    const flagMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0x422006,
      roughness: 0.3,
    });
    const banner = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.9, 0.3), flagMat);
    banner.position.set(0, 5.2, 0);
    cpGroup.add(banner);

    worldGroup.add(cpGroup);
    checkpoints.push({
      index: idx,
      z: cpZ,
      mesh: cpGroup,
      flagMat,
      reached: false,
    });
  });

  // Finish Line Gate
  const finishGroup = new THREE.Group();
  finishGroup.position.set(0, 0, stage.length);
  for (const sx of [-5.4, 5.4]) {
    const p = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.4, 6.8, 10),
      new THREE.MeshStandardMaterial({ color: 0x0047cc, metalness: 0.6 })
    );
    p.position.set(sx, 3.4, 0);
    finishGroup.add(p);
  }
  const finishBanner = new THREE.Mesh(
    new THREE.BoxGeometry(11.4, 1.5, 0.5),
    new THREE.MeshBasicMaterial({ map: textures.fizzBillboard })
  );
  finishBanner.position.set(0, 6.2, 0);
  finishGroup.add(finishBanner);
  worldGroup.add(finishGroup);

  // ==========================================================
  // HUGE GIANT FIZZ-X SODA CAN (FOR CHASE MODE!)
  // ==========================================================
  const giantCanGroup = new THREE.Group();
  giantCanGroup.visible = false;

  // Radius = 3.7m (7.4m tall!), Width = 8.4m across the road
  const giantGeo = new THREE.CylinderGeometry(3.7, 3.7, 8.4, 20);
  giantGeo.rotateZ(Math.PI / 2); // Lay horizontally across X axis so rotating around X rolls it along Z!

  const giantSideMat = new THREE.MeshStandardMaterial({
    map: textures.fizzCanSide,
    metalness: 0.55,
    roughness: 0.25,
  });
  const giantCapMat = new THREE.MeshStandardMaterial({
    map: textures.fizzCanTop,
    metalness: 0.75,
    roughness: 0.2,
  });

  const giantCanCylinder = new THREE.Mesh(giantGeo, [giantSideMat, giantCapMat, giantCapMat]);
  giantCanCylinder.position.y = 3.7;
  giantCanGroup.add(giantCanCylinder);

  // Giant shadow underneath the massive rolling can
  const giantShadowGeo = new THREE.PlaneGeometry(8.8, 6.5);
  giantShadowGeo.rotateX(-Math.PI / 2);
  const giantShadow = new THREE.Mesh(
    giantShadowGeo,
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false })
  );
  giantShadow.position.y = 0.04;
  giantCanGroup.add(giantShadow);

  worldGroup.add(giantCanGroup);

  return {
    worldGroup,
    obstacles,
    collectibles,
    checkpoints,
    npcs,
    giantCanGroup,
    giantCanCylinder,
  };
}
