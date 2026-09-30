import * as THREE from 'three';
import { getGameTextures } from './textures';

export type HeroAnimState =
  | 'idle'
  | 'run'
  | 'jump'
  | 'fall'
  | 'land'
  | 'slide'
  | 'dash'
  | 'hit'
  | 'death';

export interface SodaHeroController {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  shadowMesh: THREE.Mesh;
  dashAura: THREE.Mesh;
  updateAnimation: (state: HeroAnimState, time: number, speedRatio: number, isInvulnerable: boolean) => void;
}

export function createSodaHero(): SodaHeroController {
  const textures = getGameTextures();
  const root = new THREE.Group();
  const bodyPivot = new THREE.Group();
  root.add(bodyPivot);

  // Retro PS1 flat/gouraud-like metallic materials
  const matBlue = new THREE.MeshStandardMaterial({
    color: 0x0047d6,
    roughness: 0.28,
    metalness: 0.55,
    flatShading: true,
  });

  const matSilver = new THREE.MeshStandardMaterial({
    color: 0xeef5ff,
    roughness: 0.2,
    metalness: 0.75,
    flatShading: true,
  });

  const matDarkBlue = new THREE.MeshStandardMaterial({
    color: 0x001f66,
    roughness: 0.35,
    metalness: 0.45,
    flatShading: true,
  });

  const matRedAccent = new THREE.MeshStandardMaterial({
    color: 0xe6192e,
    roughness: 0.25,
    metalness: 0.5,
    flatShading: true,
  });

  const matEmblem = new THREE.MeshStandardMaterial({
    map: textures.chestEmblem,
    roughness: 0.25,
    metalness: 0.4,
  });

  // Soft ground shadow (stays at y = 0.03)
  const shadowGeo = new THREE.CircleGeometry(0.75, 16);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.position.y = 0.03;
  root.add(shadowMesh);

  // Dash speed energy aura around character
  const auraGeo = new THREE.ConeGeometry(0.95, 2.5, 12, 1, true);
  auraGeo.rotateX(Math.PI / 2);
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const dashAura = new THREE.Mesh(auraGeo, auraMat);
  dashAura.position.set(0, 1.15, -0.3);
  bodyPivot.add(dashAura);

  // ==========================================
  // PELVIS & WAIST (Center of gravity at y=1.02)
  // ==========================================
  const pelvisGroup = new THREE.Group();
  pelvisGroup.position.set(0, 1.02, 0);
  bodyPivot.add(pelvisGroup);

  const pelvisGeo = new THREE.CylinderGeometry(0.27, 0.23, 0.24, 10);
  pelvisGeo.scale(1.15, 1, 0.82);
  const pelvisMesh = new THREE.Mesh(pelvisGeo, matDarkBlue);
  pelvisGroup.add(pelvisMesh);

  // Heroic silver belt with red FIZZ-X buckle in front (+Z)
  const beltGeo = new THREE.CylinderGeometry(0.285, 0.285, 0.07, 10);
  beltGeo.scale(1.14, 1, 0.84);
  const beltMesh = new THREE.Mesh(beltGeo, matSilver);
  beltMesh.position.y = 0.09;
  pelvisGroup.add(beltMesh);

  const buckleMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), matRedAccent);
  buckleMesh.position.set(0, 0.09, 0.23);
  buckleMesh.scale.set(1.2, 0.8, 0.5);
  pelvisGroup.add(buckleMesh);

  // ==========================================
  // MUSCULAR TORSO (V-Tapered Chest, Lats, Abs)
  // ==========================================
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 0.12, 0);
  pelvisGroup.add(torsoGroup);

  // Lower abdomen / waist (Silver core)
  const absGeo = new THREE.CylinderGeometry(0.32, 0.25, 0.3, 10);
  absGeo.scale(1.1, 1, 0.78);
  const absMesh = new THREE.Mesh(absGeo, matSilver);
  absMesh.position.y = 0.15;
  torsoGroup.add(absMesh);

  // Sculpted 6-pack abdominal definition on FRONT (+Z)
  for (let row = 0; row < 3; row++) {
    for (let col = -1; col <= 1; col += 2) {
      const abBlock = new THREE.Mesh(new THREE.SphereGeometry(0.065, 7, 6), matSilver);
      abBlock.scale.set(1.15, 0.72, 0.55);
      abBlock.position.set(col * 0.075, 0.07 + row * 0.08, 0.21);
      torsoGroup.add(abBlock);
    }
  }

  // Broad Upper Chest & Lats (Heroic V-Taper)
  const chestGeo = new THREE.CylinderGeometry(0.43, 0.32, 0.38, 12);
  chestGeo.scale(1.22, 1, 0.82);
  const chestMesh = new THREE.Mesh(chestGeo, matBlue);
  chestMesh.position.y = 0.45;
  torsoGroup.add(chestMesh);

  // Silver center sternum / racing stripe panel
  const centerPanelGeo = new THREE.CylinderGeometry(0.24, 0.18, 0.39, 8);
  centerPanelGeo.scale(0.95, 1, 0.88);
  const centerPanel = new THREE.Mesh(centerPanelGeo, matSilver);
  centerPanel.position.y = 0.45;
  torsoGroup.add(centerPanel);

  // Sculpted Pectoral Muscles on FRONT (+Z)
  for (const side of [-1, 1]) {
    const pec = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), matSilver);
    pec.scale.set(1.15, 0.82, 0.68);
    pec.position.set(side * 0.15, 0.48, 0.23);
    torsoGroup.add(pec);

    // Upper back lat/trap muscles on BACK (-Z)
    const backLat = new THREE.Mesh(new THREE.SphereGeometry(0.18, 9, 8), matBlue);
    backLat.scale.set(1.1, 0.95, 0.6);
    backLat.position.set(side * 0.16, 0.47, -0.21);
    torsoGroup.add(backLat);
  }

  // Iconic FIZZ-X Soda Emblem on Front Chest (+Z)
  const frontEmblem = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 14), matEmblem);
  frontEmblem.rotation.x = Math.PI / 2;
  frontEmblem.position.set(0, 0.49, 0.33);
  torsoGroup.add(frontEmblem);

  // Secondary Emblem on Upper Back (-Z) so rear camera looks awesome too
  const backEmblem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 14), matEmblem);
  backEmblem.rotation.x = -Math.PI / 2;
  backEmblem.position.set(0, 0.49, -0.29);
  torsoGroup.add(backEmblem);

  // ==========================================
  // NECK & SLEEK METALLIC SUPERHERO HEAD
  // ==========================================
  const neckGroup = new THREE.Group();
  neckGroup.position.set(0, 0.66, 0);
  torsoGroup.add(neckGroup);

  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.12, 10), matSilver);
  neckMesh.position.y = 0.04;
  neckGroup.add(neckMesh);

  // Sculpted muscular cranium + jawline (faces +Z)
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.21;
  neckGroup.add(headGroup);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), matSilver);
  cranium.scale.set(0.92, 1.12, 1.04);
  headGroup.add(cranium);

  // Blue half-mask side panels
  for (const side of [-1, 1]) {
    const templePanel = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), matBlue);
    templePanel.scale.set(0.5, 0.95, 0.95);
    templePanel.position.set(side * 0.09, 0.01, -0.01);
    headGroup.add(templePanel);
  }

  // Heroic Visor on FRONT (+Z) so front-facing chase camera clearly shows the hero's face!
  const visorGeo = new THREE.CylinderGeometry(0.165, 0.155, 0.075, 10, 1, false, -Math.PI * 0.38, Math.PI * 0.76);
  const visorMesh = new THREE.Mesh(visorGeo, matDarkBlue);
  visorMesh.position.set(0, 0.03, 0.035);
  headGroup.add(visorMesh);

  // Red-and-Blue aerodynamic crest fin on top of head
  const crestGeo = new THREE.BoxGeometry(0.035, 0.09, 0.24);
  const crestMesh = new THREE.Mesh(crestGeo, matRedAccent);
  crestMesh.position.set(0, 0.18, -0.01);
  headGroup.add(crestMesh);

  // ==========================================
  // BROAD SHOULDERS & MUSCULAR ARMS
  // ==========================================
  function createArm(side: -1 | 1) {
    const shoulderPivot = new THREE.Group();
    shoulderPivot.position.set(side * 0.52, 0.56, 0);
    torsoGroup.add(shoulderPivot);

    // Large rounded Deltoid shoulder muscle
    const deltoid = new THREE.Mesh(new THREE.SphereGeometry(0.175, 10, 8), side === 1 ? matBlue : matSilver);
    deltoid.scale.set(1.1, 1.0, 0.95);
    shoulderPivot.add(deltoid);

    // Sculpted Bicep / Tricep upper arm
    const bicep = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.11, 0.32, 10), matBlue);
    bicep.position.y = -0.18;
    bicep.scale.set(1.0, 1.0, 1.12);
    shoulderPivot.add(bicep);

    const bicepPeak = new THREE.Mesh(new THREE.SphereGeometry(0.115, 8, 8), matSilver);
    bicepPeak.position.set(0, -0.16, 0.04);
    bicepPeak.scale.set(0.85, 1.15, 0.9);
    shoulderPivot.add(bicepPeak);

    // Elbow & Forearm Pivot
    const elbowPivot = new THREE.Group();
    elbowPivot.position.set(0, -0.34, 0);
    shoulderPivot.add(elbowPivot);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.085, 0.3, 10), matSilver);
    forearm.position.y = -0.15;
    elbowPivot.add(forearm);

    // Heroic Blue Wrist Bracer & Clenched Fist
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.09, 0.1, 8), matDarkBlue);
    wrist.position.y = -0.26;
    elbowPivot.add(wrist);

    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 8), matBlue);
    fist.scale.set(0.95, 1.05, 1.15);
    fist.position.set(0, -0.34, 0.02);
    elbowPivot.add(fist);

    return { shoulderPivot, elbowPivot };
  }

  const leftArm = createArm(1);
  const rightArm = createArm(-1);

  // ==========================================
  // POWERFUL LEGS (Quads, Knees, Calves, Boots)
  // ==========================================
  function createLeg(side: -1 | 1) {
    const hipPivot = new THREE.Group();
    hipPivot.position.set(side * 0.21, -0.06, 0);
    pelvisGroup.add(hipPivot);

    // Muscular Quad / Thigh
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.135, 0.44, 10), matBlue);
    thigh.position.y = -0.22;
    thigh.scale.set(1.02, 1.0, 1.12);
    hipPivot.add(thigh);

    // Silver quad highlight stripe
    const quadMuscle = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), matSilver);
    quadMuscle.scale.set(0.75, 1.35, 0.85);
    quadMuscle.position.set(0, -0.21, 0.055);
    hipPivot.add(quadMuscle);

    // Knee & Lower Leg Pivot
    const kneePivot = new THREE.Group();
    kneePivot.position.set(0, -0.44, 0);
    hipPivot.add(kneePivot);

    const kneecap = new THREE.Mesh(new THREE.SphereGeometry(0.125, 8, 8), matSilver);
    kneecap.scale.set(0.95, 0.85, 1.05);
    kneePivot.add(kneecap);

    // Muscular Calf
    const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.095, 0.42, 10), matBlue);
    calf.position.y = -0.21;
     kneePivot.add(calf);

    const calfMuscle = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), matBlue);
    calfMuscle.scale.set(0.9, 1.2, 1.05);
    calfMuscle.position.set(0, -0.15, -0.04);
    kneePivot.add(calfMuscle);

    // Athletic Soda-Hero Boot (points forward along +Z)
    const anklePivot = new THREE.Group();
    anklePivot.position.set(0, -0.42, 0);
    kneePivot.add(anklePivot);

    const bootCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.105, 0.1, 8), matSilver);
    bootCuff.position.y = 0.03;
    anklePivot.add(bootCuff);

    const footMesh = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 8), matSilver);
    footMesh.scale.set(0.95, 0.65, 1.65);
    footMesh.position.set(0, -0.04, 0.075);
    anklePivot.add(footMesh);

    const soleStrip = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.035, 0.34), matRedAccent);
    soleStrip.position.set(0, -0.09, 0.075);
    anklePivot.add(soleStrip);

    return { hipPivot, kneePivot, anklePivot };
  }

  const leftLeg = createLeg(1);
  const rightLeg = createLeg(-1);

  // ==========================================
  // ANIMATION CONTROLLER
  // ==========================================
  const updateAnimation = (
    state: HeroAnimState,
    time: number,
    speedRatio: number,
    isInvulnerable: boolean
  ) => {
    // Invulnerability blink feedback
    if (isInvulnerable) {
      bodyPivot.visible = Math.floor(time * 22) % 2 === 0;
    } else {
      bodyPivot.visible = true;
    }

    // Reset base transforms
    bodyPivot.position.set(0, 0, 0);
    bodyPivot.rotation.set(0, 0, 0);
    pelvisGroup.position.set(0, 1.02, 0);
    pelvisGroup.rotation.set(0, 0, 0);
    torsoGroup.rotation.set(0, 0, 0);
    neckGroup.rotation.set(0, 0, 0);

    // Dash aura visibility
    if (state === 'dash') {
      (dashAura.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(time * 35) * 0.15;
      dashAura.rotation.z = time * 12;
    } else {
      (dashAura.material as THREE.MeshBasicMaterial).opacity = 0;
    }

    if (state === 'run' || state === 'dash') {
      const freq = state === 'dash' ? 22 : 15 * Math.max(0.75, speedRatio);
      const phase = time * freq;
      const swing = Math.sin(phase);
      const cosPhase = Math.cos(phase);

      // Vertical running bounce
      const bounce = Math.abs(Math.cos(phase)) * (state === 'dash' ? 0.14 : 0.11);
      pelvisGroup.position.y = 1.0 + bounce;

      // Forward heroic sprint lean (+X rotation leans forward toward +Z)
      torsoGroup.rotation.x = state === 'dash' ? 0.36 : 0.18;
      // Athletic shoulder counter-twist
      torsoGroup.rotation.y = -swing * 0.24;
      pelvisGroup.rotation.y = swing * 0.14;
      neckGroup.rotation.y = swing * 0.18;
      neckGroup.rotation.x = state === 'dash' ? -0.22 : -0.1;

      // Left & Right Legs pumping
      leftLeg.hipPivot.rotation.x = -swing * 0.95;
      rightLeg.hipPivot.rotation.x = swing * 0.95;
      leftLeg.hipPivot.rotation.z = 0;
      rightLeg.hipPivot.rotation.z = 0;

      // Knee bend on recovery stride (positive X rotation bends lower leg backward toward -Z)
      leftLeg.kneePivot.rotation.x = Math.max(0.1, cosPhase * 1.15 + 0.45);
      rightLeg.kneePivot.rotation.x = Math.max(0.1, -cosPhase * 1.15 + 0.45);

      // Opposite Arms pumping strongly
      leftArm.shoulderPivot.rotation.x = swing * 0.95;
      rightArm.shoulderPivot.rotation.x = -swing * 0.95;
      leftArm.shoulderPivot.rotation.z = 0.14;
      rightArm.shoulderPivot.rotation.z = -0.14;

      // Elbows bent forward (-X rotation bends forearm toward +Z)
      leftArm.elbowPivot.rotation.x = -1.15 + swing * 0.35;
      rightArm.elbowPivot.rotation.x = -1.15 - swing * 0.35;

      shadowMesh.scale.setScalar(1 - bounce * 1.2);
    } else if (state === 'jump' || state === 'fall') {
      // Heroic mid-air leap pose
      pelvisGroup.position.y = 1.05;
      torsoGroup.rotation.x = state === 'jump' ? 0.12 : 0.22;
      torsoGroup.rotation.y = 0;

      // Left leg tucked high forward, right leg extended back
      leftLeg.hipPivot.rotation.x = -0.95;
      leftLeg.kneePivot.rotation.x = 1.25;
      rightLeg.hipPivot.rotation.x = 0.55;
      rightLeg.kneePivot.rotation.x = 0.45;

      // Arms raised heroically
      leftArm.shoulderPivot.rotation.x = -0.85;
      leftArm.shoulderPivot.rotation.z = 0.32;
      leftArm.elbowPivot.rotation.x = -0.9;

      rightArm.shoulderPivot.rotation.x = 0.45;
      rightArm.shoulderPivot.rotation.z = -0.32;
      rightArm.elbowPivot.rotation.x = -1.1;
    } else if (state === 'land') {
      pelvisGroup.position.y = 0.78;
      torsoGroup.rotation.x = 0.35;
      leftLeg.hipPivot.rotation.x = -0.55;
      leftLeg.kneePivot.rotation.x = 1.1;
      rightLeg.hipPivot.rotation.x = -0.55;
      rightLeg.kneePivot.rotation.x = 1.1;
      leftArm.shoulderPivot.rotation.x = 0.3;
      rightArm.shoulderPivot.rotation.x = 0.3;
    } else if (state === 'slide') {
      // Low ground slide under trucks & barriers!
      // Drop pelvis close to asphalt (y = 0.36) and recline torso backward (-X rotation)
      pelvisGroup.position.set(0, 0.36, 0.1);
      pelvisGroup.rotation.x = -1.08;
      torsoGroup.rotation.x = -0.15;
      neckGroup.rotation.x = 0.75; // Look forward while sliding!

      // Right leg extended straight forward along the ground (+Z)
      rightLeg.hipPivot.rotation.x = -0.38;
      rightLeg.kneePivot.rotation.x = 0.08;

      // Left leg bent tucked beside body
      leftLeg.hipPivot.rotation.x = 0.15;
      leftLeg.hipPivot.rotation.z = 0.35;
      leftLeg.kneePivot.rotation.x = 1.45;

      // Arms swept back for balance
      leftArm.shoulderPivot.rotation.x = 0.75;
      leftArm.shoulderPivot.rotation.z = 0.4;
      leftArm.elbowPivot.rotation.x = -0.5;

      rightArm.shoulderPivot.rotation.x = 0.75;
      rightArm.shoulderPivot.rotation.z = -0.4;
      rightArm.elbowPivot.rotation.x = -0.5;

      shadowMesh.scale.set(1.25, 1, 1.45);
    } else if (state === 'hit') {
      const wobble = Math.sin(time * 28);
      pelvisGroup.position.y = 0.92;
      torsoGroup.rotation.x = -0.38;
      torsoGroup.rotation.z = wobble * 0.25;
      leftArm.shoulderPivot.rotation.x = -1.2;
      leftArm.shoulderPivot.rotation.z = 0.65;
      rightArm.shoulderPivot.rotation.x = -1.2;
      rightArm.shoulderPivot.rotation.z = -0.65;
      leftLeg.hipPivot.rotation.x = -0.35;
      rightLeg.hipPivot.rotation.x = 0.35;
    } else if (state === 'death') {
      // Knocked flat on the road
      pelvisGroup.position.set(0, 0.22, 0);
      pelvisGroup.rotation.x = -Math.PI / 2;
      pelvisGroup.rotation.z = 0.2;
      torsoGroup.rotation.x = 0;
      leftArm.shoulderPivot.rotation.z = 1.1;
      rightArm.shoulderPivot.rotation.z = -1.1;
      leftArm.elbowPivot.rotation.x = -0.3;
      rightArm.elbowPivot.rotation.x = -0.3;
      leftLeg.hipPivot.rotation.x = 0.1;
      rightLeg.hipPivot.rotation.x = 0.1;
      leftLeg.hipPivot.rotation.z = 0.25;
      rightLeg.hipPivot.rotation.z = -0.25;
      leftLeg.kneePivot.rotation.x = 0.15;
      rightLeg.kneePivot.rotation.x = 0.15;
    } else {
      // Idle heroic breathing pose (for menu / preview)
      const breath = Math.sin(time * 3.2);
      pelvisGroup.position.y = 1.02 + breath * 0.025;
      torsoGroup.rotation.x = 0.04;
      torsoGroup.rotation.y = Math.sin(time * 1.5) * 0.12;
      leftArm.shoulderPivot.rotation.x = 0.12;
      leftArm.shoulderPivot.rotation.z = 0.22;
      leftArm.elbowPivot.rotation.x = -0.55;
      rightArm.shoulderPivot.rotation.x = -0.12;
      rightArm.shoulderPivot.rotation.z = -0.22;
      rightArm.elbowPivot.rotation.x = -0.55;
      leftLeg.hipPivot.rotation.x = -0.06;
      leftLeg.hipPivot.rotation.z = 0.08;
      rightLeg.hipPivot.rotation.x = 0.06;
      rightLeg.hipPivot.rotation.z = -0.08;
      leftLeg.kneePivot.rotation.x = 0.08;
      rightLeg.kneePivot.rotation.x = 0.08;
    }
  };

  return {
    root,
    bodyPivot,
    shadowMesh,
    dashAura,
    updateAnimation,
  };
}
