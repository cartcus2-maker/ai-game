import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Settings,
  HelpCircle,
  Trophy,
  Zap,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Eye,
  Sparkles,
  Flag,
  Heart,
} from 'lucide-react';
import { soundEngine } from './audio/soundEngine';
import { createSodaHero, HeroAnimState, SodaHeroController } from './game/characterBuilder';
import {
  buildStageWorld,
  BuiltStageWorld,
  LANES,
  STAGES,
  StageConfig,
} from './game/worldBuilder';

export type CameraMode =
  | 'NORMAL_CAMERA'
  | 'CHASE_TRANSITION'
  | 'CHASE_FRONT_CAMERA'
  | 'CHASE_END_TRANSITION'
  | 'MENU_CAMERA';

export type GameScreenState =
  | 'MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'STAGE_COMPLETE'
  | 'GAME_OVER';

export type MenuHeroView = 'front' | 'back' | 'side' | 'orbit';

interface UpcomingHazard {
  laneIndex: number; // 0, 1, 2 or -1 for all lanes (truck slide)
  actionFa: string;
  type: 'jump' | 'slide' | 'dodge';
  dist: number;
}

interface BurstParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // UI React States
  const [screenState, setScreenState] = useState<GameScreenState>('MENU');
  const [selectedStageIdx, setSelectedStageIdx] = useState<number>(0);
  const [unlockedStageIdx, setUnlockedStageIdx] = useState<number>(3); // All 4 stages accessible
  const [cansCollected, setCansCollected] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  const [timeLeft, setTimeLeft] = useState<number>(85);
  const [progressRatio, setProgressRatio] = useState<number>(0);
  const [distanceMeters, setDistanceMeters] = useState<number>(0);
  const [cameraModeUi, setCameraModeUi] = useState<CameraMode>('MENU_CAMERA');
  const [dashCharge, setDashCharge] = useState<number>(100);
  const [isDashingUi, setIsDashingUi] = useState<boolean>(false);

  // Center screen Persian announcements
  const [bannerText, setBannerText] = useState<string | null>(null);
  const [bannerSubText, setBannerSubText] = useState<string | null>(null);
  const [bannerTone, setBannerTone] = useState<'warning' | 'success' | 'danger'>('warning');

  // Upcoming obstacle indicator during front-camera chase & truck approach
  const [upcomingHazards, setUpcomingHazards] = useState<UpcomingHazard[]>([]);

  // Modals & Settings
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [showCharacterLab, setShowCharacterLab] = useState<boolean>(false);
  const [retroScanlines, setRetroScanlines] = useState<boolean>(true);
  const [pixelScale, setPixelScale] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showTouchControls, setShowTouchControls] = useState<boolean>(true);

  // Menu character preview states
  const [menuHeroView, setMenuHeroView] = useState<MenuHeroView>('front');
  const [menuHeroAnim, setMenuHeroAnim] = useState<HeroAnimState>('run');

  // Mutable Game Engine State inside Ref for 60fps loop
  const engineRef = useRef<{
    scene: THREE.Scene | null;
    camera: THREE.PerspectiveCamera | null;
    renderer: THREE.WebGLRenderer | null;
    hero: SodaHeroController | null;
    world: BuiltStageWorld | null;
    stage: StageConfig;
    screen: GameScreenState;
    cameraMode: CameraMode;
    cameraTransitionT: number;

    // Player physics & movement
    playerX: number;
    targetLaneX: number;
    playerY: number;
    playerVy: number;
    playerZ: number;
    currentSpeed: number;
    isGrounded: boolean;
    isSliding: boolean;
    slideTimer: number;
    isDashing: boolean;
    dashTimer: number;
    dashCooldown: number;
    invulnTimer: number;
    hitStunTimer: number;
    landTimer: number;
    deathTimer: number;

    // Stage progress & checkpoints
    cans: number;
    scoreVal: number;
    livesCount: number;
    timerSec: number;
    lastCheckpointZ: number;
    lastCheckpointTime: number;

    // Giant Soda Can Chase state
    chaseTriggered: boolean;
    chaseCompleted: boolean;
    giantCanZ: number;
    giantCanX: number;

    // Held keys
    keys: {
      left: boolean;
      right: boolean;
    };

    // Menu inspection
    menuView: MenuHeroView;
    menuAnim: HeroAnimState;

    // Footstep timer
    stepAccum: number;
    lastBeepSec: number;
    bannerTimeout: number | null;
    particles: BurstParticle[];
    warningStripsGroup: THREE.Group | null;
  }>({
    scene: null,
    camera: null,
    renderer: null,
    hero: null,
    world: null,
    stage: STAGES[0],
    screen: 'MENU',
    cameraMode: 'MENU_CAMERA',
    cameraTransitionT: 0,

    playerX: 0,
    targetLaneX: 0,
    playerY: 0,
    playerVy: 0,
    playerZ: 0,
    currentSpeed: 21,
    isGrounded: true,
    isSliding: false,
    slideTimer: 0,
    isDashing: false,
    dashTimer: 0,
    dashCooldown: 100,
    invulnTimer: 0,
    hitStunTimer: 0,
    landTimer: 0,
    deathTimer: 0,

    cans: 0,
    scoreVal: 0,
    livesCount: 3,
    timerSec: 85,
    lastCheckpointZ: 0,
    lastCheckpointTime: 85,

    chaseTriggered: false,
    chaseCompleted: false,
    giantCanZ: -20,
    giantCanX: 0,

    keys: { left: false, right: false },
    menuView: 'front',
    menuAnim: 'run',
    stepAccum: 0,
    lastBeepSec: -1,
    bannerTimeout: null,
    particles: [],
    warningStripsGroup: null,
  });

  const showBanner = useCallback(
    (title: string, sub: string | null = null, tone: 'warning' | 'success' | 'danger' = 'warning', durationMs = 2400) => {
      setBannerText(title);
      setBannerSubText(sub);
      setBannerTone(tone);
      if (engineRef.current.bannerTimeout) {
        window.clearTimeout(engineRef.current.bannerTimeout);
      }
      engineRef.current.bannerTimeout = window.setTimeout(() => {
        setBannerText(null);
        setBannerSubText(null);
      }, durationMs);
    },
    []
  );

  const spawnBurstParticles = useCallback((x: number, y: number, z: number, colorHex: number, count: number = 10) => {
    const eng = engineRef.current;
    if (!eng.scene) return;
    const geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });

    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      eng.scene.add(m);
      eng.particles.push({
        mesh: m,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 6 + 2,
        vz: (Math.random() - 0.5) * 8,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.25,
      });
    }
  }, []);

  // Load or rebuild a stage in the 3D scene
  const loadStageIntoScene = useCallback((stageIdx: number, startAtChase: boolean = false) => {
    const eng = engineRef.current;
    if (!eng.scene) return;

    const stage = STAGES[stageIdx] || STAGES[0];
    eng.stage = stage;

    // Clean up old world
    if (eng.world) {
      eng.scene.remove(eng.world.worldGroup);
    }
    if (eng.warningStripsGroup) {
      eng.scene.remove(eng.warningStripsGroup);
    }

    // Clear old particles
    eng.particles.forEach((p) => eng.scene?.remove(p.mesh));
    eng.particles = [];

    // Update sky and fog
    eng.scene.background = new THREE.Color(stage.skyColor);
    eng.scene.fog = new THREE.FogExp2(stage.fogColor, 0.0085);

    const built = buildStageWorld(stage);
    eng.world = built;
    eng.scene.add(built.worldGroup);

    // Warning strips on road ahead of player for front-camera readability
    const warnGroup = new THREE.Group();
    eng.scene.add(warnGroup);
    eng.warningStripsGroup = warnGroup;

    const startZ = startAtChase ? stage.chaseStartZ - 12 : 0;
    eng.playerX = 0;
    eng.targetLaneX = 0;
    eng.playerY = 0;
    eng.playerVy = 0;
    eng.playerZ = startZ;
    eng.currentSpeed = stage.baseSpeed;
    eng.isGrounded = true;
    eng.isSliding = false;
    eng.slideTimer = 0;
    eng.isDashing = false;
    eng.dashTimer = 0;
    eng.dashCooldown = 100;
    eng.invulnTimer = 1.0;
    eng.hitStunTimer = 0;
    eng.landTimer = 0;
    eng.deathTimer = 0;

    eng.lastCheckpointZ = startZ;
    eng.lastCheckpointTime = stage.timeLimit;
    eng.timerSec = stage.timeLimit;
    eng.chaseTriggered = false;
    eng.chaseCompleted = false;
    eng.giantCanZ = startZ - 15;
    eng.giantCanX = 0;
    eng.cameraMode = 'NORMAL_CAMERA';
    eng.cameraTransitionT = 0;

    setCansCollected(eng.cans);
    setLives(eng.livesCount);
    setTimeLeft(stage.timeLimit);
    setProgressRatio(startZ / stage.length);
    setDistanceMeters(Math.floor(startZ));
    setCameraModeUi('NORMAL_CAMERA');
    setDashCharge(100);
    setIsDashingUi(false);
  }, []);

  // Start Game handler
  const startGame = useCallback(
    (stageIdx: number = selectedStageIdx, startAtChase: boolean = false) => {
      const eng = engineRef.current;
      eng.cans = 0;
      eng.scoreVal = 0;
      eng.livesCount = 3;
      setScore(0);
      setSelectedStageIdx(stageIdx);

      loadStageIntoScene(stageIdx, startAtChase);

      eng.screen = 'PLAYING';
      setScreenState('PLAYING');
      setShowSettings(false);
      setShowGuide(false);
      setShowCharacterLab(false);

      soundEngine.startMusic('normal');
      const st = STAGES[stageIdx] || STAGES[0];
      showBanner(`مرحله ${st.code}: ${st.titleFa}`, st.subtitleFa, 'success', 2400);
    },
    [loadStageIntoScene, selectedStageIdx, showBanner]
  );

  // Respawn from latest checkpoint
  const respawnAtCheckpoint = useCallback(() => {
    const eng = engineRef.current;
    if (!eng.world) return;

    eng.playerX = 0;
    eng.targetLaneX = 0;
    eng.playerY = 0;
    eng.playerVy = 0;
    eng.playerZ = eng.lastCheckpointZ;
    eng.isGrounded = true;
    eng.isSliding = false;
    eng.slideTimer = 0;
    eng.isDashing = false;
    eng.dashTimer = 0;
    eng.invulnTimer = 2.2;
    eng.hitStunTimer = 0;
    eng.deathTimer = 0;
    eng.timerSec = Math.max(35, eng.lastCheckpointTime);

    // Reset obstacles ahead of checkpoint
    eng.world.obstacles.forEach((obs) => {
      if (obs.z >= eng.lastCheckpointZ - 5) {
        obs.hitAlready = false;
        obs.crushedByCan = false;
        obs.mesh.visible = true;
        obs.mesh.position.y = 0;
        obs.mesh.rotation.set(0, obs.kind === 'sedan' || obs.kind === 'police' ? Math.PI : 0, 0);
      }
    });

    // Check if checkpoint is inside the chase zone or before it
    if (eng.playerZ >= eng.stage.chaseStartZ && eng.playerZ < eng.stage.chaseEndZ) {
      eng.chaseTriggered = true;
      eng.chaseCompleted = false;
      eng.giantCanZ = eng.playerZ - 12.5;
      eng.world.giantCanGroup.visible = true;
      eng.cameraMode = 'CHASE_FRONT_CAMERA';
      setCameraModeUi('CHASE_FRONT_CAMERA');
      soundEngine.startMusic('chase');
      showBanner('فرار کن!', 'ادامه از آخرین نقطه کنترل', 'warning', 2000);
    } else {
      eng.chaseTriggered = eng.playerZ >= eng.stage.chaseEndZ;
      eng.chaseCompleted = eng.playerZ >= eng.stage.chaseEndZ;
      eng.world.giantCanGroup.visible = false;
      eng.cameraMode = 'NORMAL_CAMERA';
      setCameraModeUi('NORMAL_CAMERA');
      soundEngine.startMusic('normal');
      showBanner('ادامه از نقطه کنترل!', `جان باقی‌مانده: ${eng.livesCount}`, 'warning', 2000);
    }
  }, [showBanner]);

  // Trigger Jump, Slide, Dash, Left/Right actions
  const triggerJump = useCallback(() => {
    const eng = engineRef.current;
    if (eng.screen !== 'PLAYING' || eng.deathTimer > 0) return;
    if (eng.isGrounded) {
      eng.isGrounded = false;
      eng.isSliding = false;
      eng.slideTimer = 0;
      eng.playerVy = 12.8; // Reaches ~2.55m peak height to clear holes and cars!
      soundEngine.playJump();
    }
  }, []);

  const triggerSlide = useCallback(() => {
    const eng = engineRef.current;
    if (eng.screen !== 'PLAYING' || eng.deathTimer > 0) return;
    eng.isSliding = true;
    eng.slideTimer = 0.78; // Plenty of time to slide cleanly underneath the FIZZ-X truck!
    if (!eng.isGrounded) {
      // Fast drop to ground if mid-air
      eng.playerVy = -18;
    }
    soundEngine.playSlide();
  }, []);

  const triggerDash = useCallback(() => {
    const eng = engineRef.current;
    if (eng.screen !== 'PLAYING' || eng.deathTimer > 0) return;
    if (eng.dashCooldown >= 35 && !eng.isDashing) {
      eng.isDashing = true;
      eng.dashTimer = 1.15;
      eng.dashCooldown = Math.max(0, eng.dashCooldown - 50);
      setIsDashingUi(true);
      soundEngine.playDash();
      spawnBurstParticles(eng.playerX, eng.playerY + 1.0, eng.playerZ, 0x38bdf8, 14);
    }
  }, [spawnBurstParticles]);

  // Screen-relative Left / Right lane shift so controls NEVER feel inverted in any camera mode!
  const nudgeHorizontal = useCallback((screenDir: 'left' | 'right') => {
    const eng = engineRef.current;
    if (eng.screen !== 'PLAYING' || eng.deathTimer > 0) return;

    // In NORMAL_CAMERA (looking toward +Z): Screen Left is +X, Screen Right is -X.
    // In CHASE_FRONT_CAMERA (looking toward -Z): Screen Left is -X, Screen Right is +X.
    const isFrontCam =
      eng.cameraMode === 'CHASE_FRONT_CAMERA' ||
      (eng.cameraMode === 'CHASE_TRANSITION' && eng.cameraTransitionT > 0.5);

    const worldDeltaX =
      screenDir === 'left'
        ? isFrontCam
          ? -3.1
          : 3.1
        : isFrontCam
          ? 3.1
          : -3.1;

    const nextTarget = Math.max(-3.3, Math.min(3.3, eng.targetLaneX + worldDeltaX));
    // Snap to closest standard lane (-3.1, 0, +3.1)
    let closest = LANES[0];
    let minDiff = Math.abs(nextTarget - LANES[0]);
    for (const l of LANES) {
      if (Math.abs(nextTarget - l) < minDiff) {
        minDiff = Math.abs(nextTarget - l);
        closest = l;
      }
    }
    eng.targetLaneX = closest;
  }, []);

  const togglePause = useCallback(() => {
    const eng = engineRef.current;
    if (eng.screen === 'PLAYING') {
      eng.screen = 'PAUSED';
      setScreenState('PAUSED');
      soundEngine.stopMusic();
    } else if (eng.screen === 'PAUSED') {
      eng.screen = 'PLAYING';
      setScreenState('PLAYING');
      const isChase = eng.cameraMode === 'CHASE_FRONT_CAMERA' || eng.cameraMode === 'CHASE_TRANSITION';
      soundEngine.startMusic(isChase ? 'chase' : 'normal');
    }
  }, []);

  // Keyboard Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const code = e.code;

      if (code === 'Escape') {
        e.preventDefault();
        togglePause();
        return;
      }

      if (engineRef.current.screen !== 'PLAYING') return;

      if (code === 'KeyA' || code === 'ArrowLeft') {
        e.preventDefault();
        engineRef.current.keys.left = true;
        nudgeHorizontal('left');
      } else if (code === 'KeyD' || code === 'ArrowRight') {
        e.preventDefault();
        engineRef.current.keys.right = true;
        nudgeHorizontal('right');
      } else if (code === 'Space' || code === 'KeyW' || code === 'ArrowUp') {
        e.preventDefault();
        triggerJump();
      } else if (code === 'KeyS' || code === 'ArrowDown') {
        e.preventDefault();
        triggerSlide();
      } else if (code === 'ShiftLeft' || code === 'ShiftRight') {
        e.preventDefault();
        triggerDash();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyA' || code === 'ArrowLeft') {
        engineRef.current.keys.left = false;
      } else if (code === 'KeyD' || code === 'ArrowRight') {
        engineRef.current.keys.right = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [nudgeHorizontal, togglePause, triggerDash, triggerJump, triggerSlide]);

  // Sync menu inspection states into engineRef
  useEffect(() => {
    engineRef.current.menuView = menuHeroView;
    engineRef.current.menuAnim = menuHeroAnim;
  }, [menuHeroView, menuHeroAnim]);

  // Adjust pixel resolution for authentic PS1 feel if toggled
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng.renderer) return;
    eng.renderer.setPixelRatio(pixelScale ? 0.72 : Math.min(window.devicePixelRatio, 2));
  }, [pixelScale]);

  // Main Three.js Scene Initialization & 60FPS Game Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(STAGES[0].skyColor);
    scene.fog = new THREE.FogExp2(STAGES[0].fogColor, 0.0085);

    const camera = new THREE.PerspectiveCamera(
      62,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.2,
      260
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(0.75);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Bright Sunny Daytime Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.05);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.55);
    sunLight.position.set(18, 36, -15);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    rimLight.position.set(-15, 12, 22);
    scene.add(rimLight);

    // Build our Muscular Blue-and-White Soda Superhero
    const hero = createSodaHero();
    scene.add(hero.root);

    const eng = engineRef.current;
    eng.scene = scene;
    eng.camera = camera;
    eng.renderer = renderer;
    eng.hero = hero;

    // Build initial stage world for menu background
    loadStageIntoScene(0, false);
    eng.cameraMode = 'MENU_CAMERA';

    const handleResize = () => {
      if (!container || !eng.renderer || !eng.camera) return;
      eng.camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
      eng.camera.updateProjectionMatrix();
      eng.renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    let animFrameId: number;
    let lastTime = performance.now();
    let hudSyncAccum = 0;
    const lookTarget = new THREE.Vector3();

    const animate = (now: number) => {
      animFrameId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const elapsedSec = now / 1000;

      if (!eng.hero || !eng.world || !eng.camera || !eng.renderer) return;

      // Update Burst Particles
      for (let i = eng.particles.length - 1; i >= 0; i--) {
        const p = eng.particles[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          eng.scene?.remove(p.mesh);
          eng.particles.splice(i, 1);
        } else {
          p.mesh.position.x += p.vx * dt;
          p.mesh.position.y += p.vy * dt;
          p.mesh.position.z += p.vz * dt;
          p.vy -= 18 * dt;
          const s = 1 - p.life / p.maxLife;
          p.mesh.scale.setScalar(s);
        }
      }

      // Rotate & float collectible FIZZ-X cans
      for (const can of eng.world.collectibles) {
        if (!can.collected && Math.abs(can.z - eng.playerZ) < 120) {
          can.mesh.rotation.y = elapsedSec * 3.4 + can.id * 0.5;
          can.mesh.position.y = can.y + Math.sin(elapsedSec * 4.5 + can.id) * 0.12;
        }
      }

      // Animate sidewalk NPCs
      for (const npc of eng.world.npcs) {
        if (Math.abs(npc.baseZ - eng.playerZ) < 130) {
          const walkOffset = Math.sin(elapsedSec * 0.6 + npc.phase) * 7;
          npc.mesh.position.z = npc.baseZ + walkOffset;
          npc.mesh.rotation.y = Math.cos(elapsedSec * 0.6 + npc.phase) >= 0 ? 0 : Math.PI;
          const legSwing = Math.sin(elapsedSec * 8 + npc.phase) * 0.55;
          npc.leftLeg.rotation.x = legSwing;
          npc.rightLeg.rotation.x = -legSwing;
          npc.leftArm.rotation.x = -legSwing * 0.8;
          npc.rightArm.rotation.x = legSwing * 0.8;
        }
      }

      // =====================================================
      // MENU CAMERA & CHARACTER PREVIEW MODE
      // =====================================================
      if (eng.screen === 'MENU') {
        eng.playerX = 0;
        eng.playerY = 0;
        eng.playerZ = 18;
        eng.hero.root.position.set(0, 0, eng.playerZ);
        eng.hero.root.rotation.y = 0; // Hero front faces +Z

        eng.hero.updateAnimation(eng.menuAnim, elapsedSec, 1.0, false);

        // Position camera based on selected view (Front, Back, Side, or Orbit)
        let camX = 0;
        let camY = 1.65;
        let camZ = eng.playerZ + 3.8;

        if (eng.menuView === 'front') {
          camX = 0;
          camY = 1.45;
          camZ = eng.playerZ + 3.4; // In front of hero (+Z)
        } else if (eng.menuView === 'back') {
          camX = 0;
          camY = 1.55;
          camZ = eng.playerZ - 3.4; // Behind hero (-Z)
        } else if (eng.menuView === 'side') {
          camX = 3.4;
          camY = 1.45;
          camZ = eng.playerZ; // Side profile
        } else {
          camX = Math.sin(elapsedSec * 0.7) * 3.8;
          camZ = eng.playerZ + Math.cos(elapsedSec * 0.7) * 3.8;
          camY = 1.6;
        }

        eng.camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.12);
        eng.camera.lookAt(0, 1.15, eng.playerZ);
        eng.renderer.render(eng.scene!, eng.camera);
        return;
      }

      // =====================================================
      // PAUSED / STAGE COMPLETE / GAME OVER
      // =====================================================
      if (eng.screen !== 'PLAYING') {
        eng.renderer.render(eng.scene!, eng.camera);
        return;
      }

      // =====================================================
      // ACTIVE GAMEPLAY LOOP
      // =====================================================
      // 1. Check Death Timer
      if (eng.deathTimer > 0) {
        eng.deathTimer -= dt;
        eng.hero.updateAnimation('death', elapsedSec, 0, false);
        if (eng.deathTimer <= 0) {
          if (eng.livesCount > 0) {
            respawnAtCheckpoint();
          } else {
            eng.screen = 'GAME_OVER';
            setScreenState('GAME_OVER');
            soundEngine.stopMusic();
          }
        }
        eng.renderer.render(eng.scene!, eng.camera);
        return;
      }

      // 2. Countdown Stage Timer
      eng.timerSec -= dt;
      if (eng.timerSec <= 10 && Math.floor(eng.timerSec) !== eng.lastBeepSec && eng.timerSec > 0) {
        eng.lastBeepSec = Math.floor(eng.timerSec);
        soundEngine.playTimerWarning();
      }
      if (eng.timerSec <= 0) {
        eng.timerSec = 0;
        eng.livesCount -= 1;
        setLives(eng.livesCount);
        soundEngine.playCrashDeath();
        showBanner('زمان تمام شد!', 'بازگشت به آخرین نقطه کنترل...', 'danger', 2200);
        eng.deathTimer = 1.3;
        return;
      }

      // 3. Speed, Dash & Stun Management
      if (eng.invulnTimer > 0) eng.invulnTimer = Math.max(0, eng.invulnTimer - dt);
      if (eng.hitStunTimer > 0) eng.hitStunTimer = Math.max(0, eng.hitStunTimer - dt);
      if (eng.landTimer > 0) eng.landTimer = Math.max(0, eng.landTimer - dt);

      if (eng.isDashing) {
        eng.dashTimer -= dt;
        if (eng.dashTimer <= 0) {
          eng.isDashing = false;
          setIsDashingUi(false);
        }
      } else {
        eng.dashCooldown = Math.min(100, eng.dashCooldown + dt * 18);
      }

      if (eng.isSliding) {
        eng.slideTimer -= dt;
        if (eng.slideTimer <= 0) {
          eng.isSliding = false;
        }
      }

      const inChaseZone = eng.chaseTriggered && !eng.chaseCompleted;
      const targetBaseSpeed = inChaseZone ? eng.stage.chaseSpeed : eng.stage.baseSpeed;
      const dashMultiplier = eng.isDashing ? 1.42 : 1.0;
      const stunMultiplier = eng.hitStunTimer > 0 ? 0.55 : 1.0;
      const desiredSpeed = targetBaseSpeed * dashMultiplier * stunMultiplier;
      eng.currentSpeed = THREE.MathUtils.lerp(eng.currentSpeed, desiredSpeed, dt * 8);

      // Move Player Forward Automatically (+Z)
      eng.playerZ += eng.currentSpeed * dt;

      // Smooth Horizontal Movement toward targetLaneX
      eng.playerX = THREE.MathUtils.lerp(eng.playerX, eng.targetLaneX, Math.min(1, dt * 14));

      // Vertical Jump Physics
      if (!eng.isGrounded) {
        eng.playerY += eng.playerVy * dt;
        eng.playerVy -= 32.0 * dt; // Responsive arcade gravity
        if (eng.playerY <= 0) {
          eng.playerY = 0;
          eng.playerVy = 0;
          eng.isGrounded = true;
          eng.landTimer = 0.12;
          soundEngine.playLand();
        }
      }

      // Footstep Audio Rhythm
      if (eng.isGrounded && !eng.isSliding) {
        eng.stepAccum += eng.currentSpeed * dt;
        if (eng.stepAccum >= 3.6) {
          eng.stepAccum = 0;
          soundEngine.playFootstep(inChaseZone);
        }
      }

      // Update Hero Mesh Position & Animation State
      eng.hero.root.position.set(eng.playerX, eng.playerY, eng.playerZ);
      // Slight bank tilt when changing lanes
      const lateralDiff = eng.targetLaneX - eng.playerX;
      eng.hero.root.rotation.z = -lateralDiff * 0.08;
      eng.hero.root.rotation.y = 0; // Always faces +Z (so Front Camera at +Z sees Hero's Front!)

      let animState: HeroAnimState = 'run';
      if (eng.hitStunTimer > 0.15) {
        animState = 'hit';
      } else if (eng.isSliding) {
        animState = 'slide';
      } else if (!eng.isGrounded) {
        animState = eng.playerVy > 0 ? 'jump' : 'fall';
      } else if (eng.landTimer > 0) {
        animState = 'land';
      } else if (eng.isDashing) {
        animState = 'dash';
      } else {
        animState = 'run';
      }

      eng.hero.updateAnimation(
        animState,
        elapsedSec,
        eng.currentSpeed / eng.stage.baseSpeed,
        eng.invulnTimer > 0
      );

      // =====================================================
      // 4. GIANT SODA CAN CHASE TRIGGER & LOGIC
      // =====================================================
      if (!eng.chaseTriggered && eng.playerZ >= eng.stage.chaseStartZ) {
        eng.chaseTriggered = true;
        eng.cameraMode = 'CHASE_TRANSITION';
        eng.cameraTransitionT = 0;
        setCameraModeUi('CHASE_TRANSITION');

        // Spawn Giant Soda Can behind the player!
        eng.giantCanZ = eng.playerZ - 13.5;
        eng.giantCanX = 0;
        eng.world.giantCanGroup.visible = true;
        eng.world.giantCanGroup.position.set(0, 0, eng.giantCanZ);

        soundEngine.playChaseWarning();
        soundEngine.startMusic('chase');
        showBanner('فرار کن!', 'قوطی غول‌پیکر FIZZ-X دنبالت است!', 'danger', 3000);
      }

      // Update Giant Soda Can movement during chase
      if (eng.chaseTriggered && !eng.chaseCompleted) {
        // Keep the Giant Can visibly chasing right behind the player (approx 10.5m - 13.5m behind)
        const idealFollowDist = eng.isDashing ? 13.8 : eng.hitStunTimer > 0 ? 7.8 : 11.2;
        const targetCanZ = eng.playerZ - idealFollowDist;
        eng.giantCanZ = THREE.MathUtils.lerp(eng.giantCanZ, targetCanZ, dt * 4.5);
        eng.giantCanX = THREE.MathUtils.lerp(eng.giantCanX, eng.playerX * 0.45, dt * 3.0);

        eng.world.giantCanGroup.position.set(eng.giantCanX, 0, eng.giantCanZ);
        // Roll the giant cylinder forward (+X rotation rolls cylinder toward +Z!)
        eng.world.giantCanCylinder.rotation.x += eng.currentSpeed * dt * 0.35;
        // Subtle menacing bounce
        eng.world.giantCanCylinder.position.y = 3.7 + Math.abs(Math.sin(elapsedSec * 12)) * 0.18;

        // Crush any obstacles that the Giant Can rolls over behind the player!
        for (const obs of eng.world.obstacles) {
          if (!obs.crushedByCan && !obs.isHole && obs.z <= eng.giantCanZ + 3.2 && obs.z >= eng.giantCanZ - 4.0) {
            obs.crushedByCan = true;
            obs.mesh.scale.y = 0.15;
            spawnBurstParticles(obs.x, 1.0, obs.z, 0xfacc15, 8);
          }
        }

        // End of Chase when reaching safe checkpoint at chaseEndZ!
        if (eng.playerZ >= eng.stage.chaseEndZ) {
          eng.chaseCompleted = true;
          eng.cameraMode = 'CHASE_END_TRANSITION';
          eng.cameraTransitionT = 0;
          setCameraModeUi('CHASE_END_TRANSITION');
          eng.world.giantCanGroup.visible = false;
          soundEngine.playCheckpoint();
          soundEngine.startMusic('normal');
          showBanner('فرار کردی!', 'نقطه کنترل ثبت شد!', 'success', 2800);
        }
      }

      // =====================================================
      // 5. DEDICATED 5-STATE CAMERA CONTROLLER
      // =====================================================
      // Dynamic FOV based on Dash & Camera state
      const targetFov = eng.isDashing
        ? 74
        : eng.cameraMode === 'CHASE_FRONT_CAMERA'
          ? 68
          : 62;
      eng.camera.fov = THREE.MathUtils.lerp(eng.camera.fov, targetFov, dt * 8);
      eng.camera.updateProjectionMatrix();

      if (eng.cameraMode === 'NORMAL_CAMERA') {
        // Classic third-person camera BEHIND the player (-Z offset), looking ahead (+Z)
        const desiredCamX = eng.playerX * 0.65;
        const desiredCamY = eng.playerY * 0.4 + 3.25;
        const desiredCamZ = eng.playerZ - (eng.isDashing ? 8.2 : 7.2);

        eng.camera.position.x = THREE.MathUtils.lerp(eng.camera.position.x, desiredCamX, dt * 10);
        eng.camera.position.y = THREE.MathUtils.lerp(eng.camera.position.y, desiredCamY, dt * 10);
        eng.camera.position.z = desiredCamZ;

        lookTarget.set(eng.playerX * 0.45, eng.playerY * 0.35 + 1.65, eng.playerZ + 12.0);
        eng.camera.lookAt(lookTarget);
      } else if (eng.cameraMode === 'CHASE_TRANSITION') {
        // Smooth 0.85s 180-degree cinematic rotation from BEHIND player (angle PI) to IN FRONT OF player (angle 0)
        eng.cameraTransitionT = Math.min(1, eng.cameraTransitionT + dt / 0.85);
        const t = eng.cameraTransitionT;
        const smoothT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        const angle = Math.PI * (1 - smoothT); // PI -> 0
        const radius = 7.6;
        eng.camera.position.x = eng.playerX * 0.65 + Math.sin(angle) * radius;
        eng.camera.position.z = eng.playerZ + Math.cos(angle) * radius;
        eng.camera.position.y = THREE.MathUtils.lerp(3.25, 2.55, smoothT);

        // Smoothly shift look target from ahead of player to the player & Giant Can behind them
        const lookZ = THREE.MathUtils.lerp(eng.playerZ + 8, eng.playerZ - 11, smoothT);
        const lookY = THREE.MathUtils.lerp(1.65, 2.15, smoothT);
        eng.camera.lookAt(eng.playerX * 0.35, lookY, lookZ);

        if (eng.cameraTransitionT >= 1) {
          eng.cameraMode = 'CHASE_FRONT_CAMERA';
          setCameraModeUi('CHASE_FRONT_CAMERA');
        }
      } else if (eng.cameraMode === 'CHASE_FRONT_CAMERA') {
        // CRITICAL FRONT-FACING CHASE CAMERA:
        // Camera is physically IN FRONT OF THE PLAYER (+Z offset) moving backward ahead of the player,
        // facing BACK TOWARD THE PLAYER (-Z) so the player runs TOWARD the camera and the GIANT SODA CAN is clearly visible BEHIND the player!
        const frontDist = eng.isDashing ? 8.5 : 7.4;
        const shakeX = (Math.random() - 0.5) * (eng.isDashing ? 0.12 : 0.06);
        const shakeY = (Math.random() - 0.5) * (eng.isDashing ? 0.12 : 0.06);

        const desiredCamX = eng.playerX * 0.65 + shakeX;
        const desiredCamY = 2.5 + eng.playerY * 0.25 + shakeY;
        const desiredCamZ = eng.playerZ + frontDist;

        eng.camera.position.x = THREE.MathUtils.lerp(eng.camera.position.x, desiredCamX, dt * 12);
        eng.camera.position.y = THREE.MathUtils.lerp(eng.camera.position.y, desiredCamY, dt * 10);
        eng.camera.position.z = desiredCamZ;

        // Look directly at the player's front torso AND the Giant Soda Can looming behind the player!
        lookTarget.set(eng.playerX * 0.35, 2.1 + eng.playerY * 0.2, eng.playerZ - 12.5);
        eng.camera.lookAt(lookTarget);
      } else if (eng.cameraMode === 'CHASE_END_TRANSITION') {
        // Smooth 0.85s transition rotating back from FRONT (0) to NORMAL REAR CAMERA (PI)
        eng.cameraTransitionT = Math.min(1, eng.cameraTransitionT + dt / 0.85);
        const t = eng.cameraTransitionT;
        const smoothT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        const angle = Math.PI * smoothT; // 0 -> PI
        const radius = 7.4;
        eng.camera.position.x = eng.playerX * 0.65 + Math.sin(angle) * radius;
        eng.camera.position.z = eng.playerZ + Math.cos(angle) * radius;
        eng.camera.position.y = THREE.MathUtils.lerp(2.55, 3.25, smoothT);

        const lookZ = THREE.MathUtils.lerp(eng.playerZ - 11, eng.playerZ + 12, smoothT);
        eng.camera.lookAt(eng.playerX * 0.4, 1.8, lookZ);

        if (eng.cameraTransitionT >= 1) {
          eng.cameraMode = 'NORMAL_CAMERA';
          setCameraModeUi('NORMAL_CAMERA');
        }
      }

      // =====================================================
      // 6. COLLECTIBLE SODA CANS PICKUP
      // =====================================================
      const playerCenterY = eng.playerY + (eng.isSliding ? 0.45 : 1.05);
      for (const can of eng.world.collectibles) {
        if (can.collected) continue;
        if (Math.abs(can.z - eng.playerZ) < 1.35 && Math.abs(can.x - eng.playerX) < 1.15) {
          if (Math.abs(can.y - playerCenterY) < 1.35) {
            can.collected = true;
            can.mesh.visible = false;
            eng.cans += 1;
            eng.scoreVal += 100;
            eng.dashCooldown = Math.min(100, eng.dashCooldown + 8);
            soundEngine.playCanPickup();
            spawnBurstParticles(can.x, can.y, can.z, 0x38bdf8, 8);
          }
        }
      }

      // =====================================================
      // 7. CHECKPOINTS DETECTION
      // =====================================================
      for (const cp of eng.world.checkpoints) {
        if (!cp.reached && eng.playerZ >= cp.z) {
          cp.reached = true;
          cp.flagMat.color.setHex(0x10b981);
          cp.flagMat.emissive.setHex(0x064e3b);
          eng.lastCheckpointZ = cp.z;
          eng.timerSec = Math.min(99, eng.timerSec + 15);
          eng.lastCheckpointTime = eng.timerSec;
          soundEngine.playCheckpoint();
          if (Math.abs(cp.z - eng.stage.chaseEndZ) > 25) {
            showBanner('نقطه کنترل ثبت شد!', '+۱۵ ثانیه زمان اضافه', 'success', 2200);
          }
        }
      }

      // =====================================================
      // 8. OBSTACLE MOVEMENT, WARNING RADAR & COLLISIONS
      // =====================================================
      const activeHazards: UpcomingHazard[] = [];

      for (const obs of eng.world.obstacles) {
        // Move dynamic traffic vehicles when close
        if (obs.vz !== 0 && Math.abs(obs.z - eng.playerZ) < 95 && obs.z > eng.playerZ - 15) {
          obs.z += obs.vz * dt;
          obs.mesh.position.z = obs.z;
        }

        const dz = obs.z - eng.playerZ;

        // Detect upcoming obstacles within 26m ahead for compact top HUD prompt
        if (dz > 0 && dz < 26 && !obs.hitAlready) {
          const isSpecial = obs.kind === 'truck_slide' || obs.isHole;
          const isFrontChase = eng.cameraMode === 'CHASE_FRONT_CAMERA';
          if (isSpecial || isFrontChase) {
            let laneIdx = -1;
            if (obs.kind !== 'truck_slide') {
              laneIdx = obs.x < -1.5 ? 0 : obs.x > 1.5 ? 2 : 1;
            }
            const actionFa =
              obs.kind === 'truck_slide'
                ? 'سرخوردن زیر کامیون! (S)'
                : obs.isHole
                  ? 'چاله! پرش کن (Space)'
                  : 'مانع در مسیر!';
            const hType = obs.kind === 'truck_slide' ? 'slide' : obs.isHole ? 'jump' : 'dodge';
            activeHazards.push({ laneIndex: laneIdx, actionFa, type: hType, dist: Math.floor(dz) });
          }
        }

        // Collision check when obstacle is at player's Z
        if (obs.hitAlready || Math.abs(dz) > obs.halfLength + 0.45) continue;
        if (Math.abs(obs.x - eng.playerX) > obs.halfWidth + 0.38) continue;

        // 1) Is it a Road Hole?
        if (obs.isHole) {
          if (eng.playerY < 0.28 && eng.invulnTimer <= 0) {
            // Fell into the road hole!
            obs.hitAlready = true;
            eng.livesCount -= 1;
            setLives(eng.livesCount);
            soundEngine.playCrashDeath();
            spawnBurstParticles(eng.playerX, 0.2, eng.playerZ, 0xf97316, 15);
            showBanner('سقوط در چاله!', 'یک جان از دست رفت', 'danger', 2000);
            eng.deathTimer = 1.25;
            break;
          }
          continue;
        }

        // 2) Is it a high obstacle with slide clearance underneath (like the FIZZ-X Delivery Truck)?
        if (obs.bottomY > 1.0) {
          const playerTopHeight = eng.isSliding ? 0.72 : 1.95;
          if (playerTopHeight < obs.bottomY) {
            // Player successfully slid underneath the truck!
            continue;
          }
        }

        // 3) Did the player jump high enough over this obstacle (e.g. jumping over a sedan or barrier)?
        if (eng.playerY >= obs.topY - 0.15) {
          continue;
        }

        // 4) If dashing through a minor barrier, smash it for bonus points!
        if (eng.isDashing && obs.isMinor) {
          obs.hitAlready = true;
          obs.mesh.visible = false;
          eng.scoreVal += 250;
          soundEngine.playMinorHit();
          spawnBurstParticles(obs.x, 0.8, obs.z, 0xfacc15, 12);
          continue;
        }

        if (eng.invulnTimer > 0) continue;

        // Collision occurred!
        obs.hitAlready = true;
        if (obs.isMinor) {
          // Minor collision: temporary stun / speed loss
          eng.hitStunTimer = 0.75;
          eng.invulnTimer = 1.2;
          soundEngine.playMinorHit();
          spawnBurstParticles(eng.playerX, 1.0, eng.playerZ, 0xf97316, 10);
          showBanner('برخورد با مانع!', 'کاهش سرعت موقت — مراقب باش!', 'warning', 1400);
        } else {
          // Major collision: lose a life
          eng.livesCount -= 1;
          setLives(eng.livesCount);
          soundEngine.playCrashDeath();
          spawnBurstParticles(eng.playerX, 1.1, eng.playerZ, 0xef4444, 18);
          showBanner(
            obs.kind === 'truck_slide' ? 'برخورد با کامیون! باید سر بخوری (S)' : 'تصادف شدید!',
            eng.livesCount > 0 ? `جان باقی‌مانده: ${eng.livesCount}` : 'تمام جان‌ها از دست رفت!',
            'danger',
            2200
          );
          eng.deathTimer = 1.3;
          break;
        }
      }

      // =====================================================
      // 9. CHECK STAGE COMPLETION
      // =====================================================
      if (eng.playerZ >= eng.stage.length) {
        eng.screen = 'STAGE_COMPLETE';
        setScreenState('STAGE_COMPLETE');
        soundEngine.stopMusic();
        soundEngine.playStageClear();
        setUnlockedStageIdx((prev) => Math.max(prev, Math.min(STAGES.length - 1, selectedStageIdx + 1)));
      }

      // Throttled React HUD state updates (~15 times/sec)
      hudSyncAccum += dt;
      if (hudSyncAccum >= 0.065) {
        hudSyncAccum = 0;
        setCansCollected(eng.cans);
        setScore(eng.scoreVal + Math.floor(eng.playerZ * 2));
        setTimeLeft(Math.max(0, eng.timerSec));
        setProgressRatio(Math.min(1, Math.max(0, eng.playerZ / eng.stage.length)));
        setDistanceMeters(Math.floor(eng.playerZ));
        setDashCharge(Math.floor(eng.dashCooldown));
        setUpcomingHazards(activeHazards.slice(0, 2));
      }

      eng.renderer.render(eng.scene!, eng.camera);
    };

    animFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      soundEngine.stopMusic();
      renderer.dispose();
    };
  }, [loadStageIntoScene, respawnAtCheckpoint, selectedStageIdx, showBanner, spawnBurstParticles]);

  // Format detailed timer "00:54:56"
  const formatRetroTimer = (sec: number) => {
    const whole = Math.max(0, Math.floor(sec));
    const centi = Math.floor((Math.max(0, sec) - whole) * 99);
    const mm = String(Math.floor(whole / 60)).padStart(2, '0');
    const ss = String(whole % 60).padStart(2, '0');
    const cc = String(centi).padStart(2, '0');
    return `${mm}:${ss}:${cc}`;
  };

  // Format Persian numerals for authentic Persian HUD
  const toPersianDigits = (val: number | string) => {
    const persian = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(val).replace(/[0-9]/g, (d) => persian[Number(d)]);
  };

  const toggleAudioMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.setMuted(next);
    if (!next && screenState === 'PLAYING') {
      const isChase =
        cameraModeUi === 'CHASE_FRONT_CAMERA' || cameraModeUi === 'CHASE_TRANSITION';
      soundEngine.startMusic(isChase ? 'chase' : 'normal');
    }
  };

  const currentStage = STAGES[selectedStageIdx] || STAGES[0];
  const isChaseCameraActive =
    cameraModeUi === 'CHASE_FRONT_CAMERA' || cameraModeUi === 'CHASE_TRANSITION';

  return (
    <div
      dir="rtl"
      className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none font-sans"
    >
      {/* 3D WebGL Viewport Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Optional PS1 Scanlines Overlay */}
      {retroScanlines && (
        <div className="absolute inset-0 pointer-events-none z-10 ps1-scanlines opacity-55" />
      )}

      {/* ================================================================= */}
      {/* IN-GAME RETRO PS1 HUD (When PLAYING or PAUSED)                    */}
      {/* ================================================================= */}
      {screenState !== 'MENU' && (
        <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-3 sm:p-5">
          {/* TOP BAR: Top-Right Stage Progress, Top-Center Timer, Top-Left Cans */}
          <div className="flex items-start justify-between gap-2 w-full">
            {/* TOP LEFT (in LTR) / TOP RIGHT (in RTL): Stage Progress Bar & Timer */}
            <div className="bg-slate-950/75 border-2 border-blue-400/50 rounded-xl px-3.5 py-2 backdrop-blur-sm shadow-lg min-w-[185px] sm:min-w-[240px]">
              <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-blue-200 mb-1">
                <span>مرحله {currentStage.code}</span>
                <span className="font-arcade text-amber-300 tracking-wider" dir="ltr">
                  {formatRetroTimer(timeLeft)}
                </span>
              </div>
              {/* Progress Bar Track */}
              <div className="relative h-3.5 bg-slate-800 rounded-full overflow-hidden border border-white/20">
                {/* Chase section highlight on progress bar */}
                <div
                  className="absolute top-0 bottom-0 bg-red-500/45"
                  style={{
                    right: `${(currentStage.chaseStartZ / currentStage.length) * 100}%`,
                    width: `${((currentStage.chaseEndZ - currentStage.chaseStartZ) / currentStage.length) * 100}%`,
                  }}
                />
                <div
                  className="h-full bg-gradient-to-l from-blue-500 via-cyan-400 to-white transition-all duration-100"
                  style={{ width: `${Math.min(100, progressRatio * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-300 mt-1">
                <span>میزان پیشرفت مرحله</span>
                <span>{toPersianDigits(Math.floor(progressRatio * 100))}٪</span>
              </div>
            </div>

            {/* TOP CENTER: Large Arcade Countdown Seconds, Score & Compact Non-Intrusive Notifications */}
            <div className="flex flex-col items-center max-w-xs sm:max-w-md">
              <div
                className={`font-arcade text-3xl sm:text-5xl font-black tracking-tight leading-none retro-text-shadow ${
                  timeLeft <= 12 ? 'text-red-500 animate-pulse' : 'text-white'
                }`}
              >
                {toPersianDigits(Math.ceil(timeLeft))}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] sm:text-xs font-extrabold text-cyan-300 retro-text-shadow">
                  ثانیه
                </span>
                <span className="text-white/40">·</span>
                <span className="text-[11px] sm:text-xs font-bold text-amber-300 retro-text-shadow">
                  امتیاز: {toPersianDigits(score)}
                </span>
              </div>

              {/* Compact Top Notifications Area (Never blocks character or road!) */}
              <div className="mt-1.5 flex flex-col items-center gap-1 pointer-events-none">
                {isChaseCameraActive && (
                  <div className="px-2.5 py-0.5 rounded-full bg-red-600/80 border border-yellow-300/80 text-white text-[10px] sm:text-xs font-bold tracking-wide shadow-md whitespace-nowrap">
                    ⚠️ تعقیب قوطی غول‌پیکر FIZZ-X — فرار کن!
                  </div>
                )}

                {bannerText && (
                  <div
                    className={`text-center px-3 py-1 rounded-xl border backdrop-blur-sm shadow-md transition-all ${
                      bannerTone === 'danger'
                        ? 'bg-red-950/75 border-red-400/70 text-red-100'
                        : bannerTone === 'success'
                          ? 'bg-emerald-950/75 border-emerald-400/70 text-emerald-100'
                          : 'bg-blue-950/75 border-cyan-400/70 text-white'
                    }`}
                  >
                    <div className="text-xs sm:text-sm font-extrabold leading-tight">
                      {bannerText}
                      {bannerSubText && (
                        <span className="text-[10px] sm:text-xs font-normal text-amber-300 mr-1.5">
                          ({bannerSubText})
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {upcomingHazards.length > 0 && (
                  <div className="flex items-center justify-center gap-1.5">
                    {upcomingHazards.slice(0, 1).map((h, i) => (
                      <div
                        key={i}
                        className={`px-2.5 py-0.5 rounded-lg border font-bold text-[10px] sm:text-xs shadow flex items-center gap-1 whitespace-nowrap ${
                          h.type === 'slide'
                            ? 'bg-amber-500/80 border-white/80 text-slate-950'
                            : h.type === 'jump'
                              ? 'bg-rose-600/80 border-yellow-300/80 text-white'
                              : 'bg-slate-900/70 border-cyan-400/60 text-cyan-200'
                        }`}
                      >
                        <ShieldAlert className="w-3 h-3 shrink-0" />
                        <span>{h.actionFa}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* TOP LEFT: Soda Can Icon & Collected Counter + Pause Button */}
            <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
              <div className="bg-slate-950/75 border-2 border-blue-400/50 rounded-xl px-3.5 py-2 backdrop-blur-sm flex items-center gap-3 shadow-lg">
                {/* Mini Stylized FIZZ-X Can SVG */}
                <div className="w-8 h-11 rounded-md bg-gradient-to-b from-slate-200 via-blue-600 to-blue-900 p-0.5 flex flex-col items-center justify-center border border-white/60 shadow-inner shrink-0">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-b from-red-600 via-white to-blue-800 border border-white" />
                  <span className="text-[7px] font-arcade font-black text-white leading-none mt-0.5">
                    FIZZ
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-2xl sm:text-3xl font-black text-white leading-none retro-blue-glow">
                    {toPersianDigits(cansCollected)}
                  </div>
                  <div className="text-xs font-bold text-cyan-300">قوطی جمع‌شده</div>
                </div>
              </div>

              <button
                onClick={togglePause}
                className="p-2.5 sm:p-3 rounded-xl bg-slate-900/85 hover:bg-blue-700 text-white border-2 border-white/25 shadow-lg transition-transform active:scale-95"
                title="توقف بازی (ESC)"
              >
                <Pause className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>

          {/* Empty middle spacer so the 3D character and road ahead are 100% clear */}
          <div className="my-auto pointer-events-none" />

          {/* BOTTOM BAR: Touch Controls + Lives + Dash Boost Meter */}
          <div className="flex flex-col gap-3 w-full">
            {/* Mobile / On-Screen Touch Controls (matches reference diagram bottom-right) */}
            {showTouchControls && screenState === 'PLAYING' && (
              <div className="flex items-end justify-between w-full pointer-events-auto gap-2">
                {/* Right side in RTL: Left & Right Steering Buttons */}
                <div className="flex items-center gap-2.5">
                  <button
                    onPointerDown={(e) => {
                      e.preventDefault();
                      nudgeHorizontal('right');
                    }}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-900/80 active:bg-blue-600 border-2 border-blue-400/60 flex flex-col items-center justify-center text-white shadow-xl"
                  >
                    <ChevronRight className="w-7 h-7" />
                    <span className="text-[10px] font-bold">راست</span>
                  </button>
                  <button
                    onPointerDown={(e) => {
                      e.preventDefault();
                      nudgeHorizontal('left');
                    }}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-900/80 active:bg-blue-600 border-2 border-blue-400/60 flex flex-col items-center justify-center text-white shadow-xl"
                  >
                    <ChevronLeft className="w-7 h-7" />
                    <span className="text-[10px] font-bold">چپ</span>
                  </button>
                </div>

                {/* Left side in RTL: Jump, Slide, Dash Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onPointerDown={(e) => {
                      e.preventDefault();
                      triggerJump();
                    }}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-blue-600/85 active:bg-blue-400 border-2 border-white/70 flex flex-col items-center justify-center text-white shadow-xl"
                  >
                    <ArrowUp className="w-6 h-6" />
                    <span className="text-[11px] font-black">پرش</span>
                  </button>
                  <button
                    onPointerDown={(e) => {
                      e.preventDefault();
                      triggerSlide();
                    }}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-500/85 active:bg-amber-400 border-2 border-white/70 flex flex-col items-center justify-center text-slate-950 shadow-xl"
                  >
                    <ArrowDown className="w-6 h-6" />
                    <span className="text-[11px] font-black">سرخوردن</span>
                  </button>
                  <button
                    onPointerDown={(e) => {
                      e.preventDefault();
                      triggerDash();
                    }}
                    disabled={dashCharge < 35}
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 flex flex-col items-center justify-center shadow-xl ${
                      dashCharge >= 35
                        ? 'bg-cyan-500/90 active:bg-cyan-300 border-white text-slate-950'
                        : 'bg-slate-800/70 border-slate-600 text-slate-400'
                    }`}
                  >
                    <Zap className="w-6 h-6" />
                    <span className="text-[11px] font-black">دش</span>
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Status Row: Lives & Dash Boost Bar */}
            <div className="flex items-center justify-between w-full">
              {/* BOTTOM RIGHT (in RTL): Lives Counter */}
              <div className="bg-slate-950/80 border-2 border-blue-400/40 rounded-xl px-3.5 py-1.5 flex items-center gap-2.5 shadow-lg">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <Heart
                      key={idx}
                      className={`w-5 h-5 ${
                        idx < lives ? 'text-red-500 fill-red-500' : 'text-slate-600'
                      }`}
                    />
                  ))}
                </div>
                <div className="text-sm sm:text-base font-black text-white">
                  {toPersianDigits(lives)} <span className="text-xs text-blue-300">جان</span>
                </div>
              </div>

              {/* Dash Energy Indicator & Keyboard Hint */}
              <div className="hidden md:flex items-center gap-3 bg-slate-950/75 border border-white/15 rounded-xl px-3.5 py-1.5 text-xs text-slate-300">
                <span>A/D: چپ و راست</span>
                <span>·</span>
                <span>Space: پرش</span>
                <span>·</span>
                <span>S: سرخوردن</span>
                <span>·</span>
                <span>Shift: دش ({toPersianDigits(dashCharge)}٪)</span>
              </div>

              {/* Audio Mute Toggle */}
              <button
                onClick={toggleAudioMute}
                className="pointer-events-auto p-2 rounded-xl bg-slate-950/80 border border-white/20 text-blue-200 hover:text-white"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* PERSIAN MAIN MENU (صفحه اصلی)                                     */}
      {/* ================================================================= */}
      {screenState === 'MENU' && (
        <div className="absolute inset-0 z-30 flex flex-col justify-between p-4 sm:p-8 pointer-events-none">
          {/* Top Header */}
          <div className="flex items-center justify-between w-full pointer-events-auto">
            <div className="flex items-center gap-3 bg-slate-950/80 border-2 border-blue-500/60 rounded-2xl px-4 py-2.5 backdrop-blur-md shadow-2xl">
              <div className="w-9 h-9 rounded-full bg-gradient-to-b from-red-600 via-white to-blue-700 border-2 border-white shrink-0" />
              <div>
                <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight retro-blue-glow">
                  بازی دویدن نوشابه‌ای <span className="font-arcade text-cyan-300">FIZZ-X</span>
                </h1>
                <p className="text-xs text-blue-200">
                  سرعت، هیجان، پرش از موانع و فرار از قوطی غول‌پیکر!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCharacterLab((v) => !v)}
                className="px-3.5 py-2 rounded-xl bg-blue-900/85 hover:bg-blue-700 border border-blue-400/50 text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 shadow-lg transition"
              >
                <Eye className="w-4 h-4 text-cyan-300" />
                <span>بررسی سه‌بعدی قهرمان</span>
              </button>
              <button
                onClick={toggleAudioMute}
                className="p-2.5 rounded-xl bg-slate-900/85 hover:bg-slate-800 border border-white/20 text-white shadow-lg"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Main Menu Grid: Right Menu Column + Optional Character Lab */}
          <div className="flex flex-col lg:flex-row items-center lg:items-end justify-between gap-6 my-auto w-full">
            {/* Primary Persian Menu Card */}
            <div className="w-full max-w-md bg-slate-950/85 border-2 border-blue-500/60 rounded-3xl p-5 sm:p-6 backdrop-blur-md shadow-2xl pointer-events-auto">
              {/* Stage Selector */}
              <div className="mb-4">
                <div className="text-xs font-bold text-cyan-300 mb-2 flex items-center justify-between">
                  <span>انتخاب مرحله (۴ محیط متنوع):</span>
                  <span>مرحله {STAGES[selectedStageIdx].code}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {STAGES.map((st, idx) => {
                    const active = selectedStageIdx === idx;
                    return (
                      <button
                        key={st.id}
                        onClick={() => {
                          setSelectedStageIdx(idx);
                          loadStageIntoScene(idx, false);
                          engineRef.current.cameraMode = 'MENU_CAMERA';
                        }}
                        className={`p-2.5 rounded-xl border text-right transition ${
                          active
                            ? 'bg-blue-600/90 border-white text-white shadow-lg'
                            : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-blue-400'
                        }`}
                      >
                        <div className="text-xs font-black">
                          مرحله {toPersianDigits(st.id)}: {st.titleFa}
                        </div>
                        <div className="text-[10px] opacity-80 truncate mt-0.5">
                          {st.subtitleFa}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Main Menu Action Buttons */}
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => startGame(selectedStageIdx, false)}
                  className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-l from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black text-lg border-2 border-white/80 shadow-xl flex items-center justify-center gap-2 transition transform active:scale-98 cursor-pointer"
                >
                  <Play className="w-6 h-6 fill-current" />
                  <span>شروع بازی</span>
                </button>

                <button
                  onClick={() => startGame(selectedStageIdx, true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-l from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-sm border border-yellow-300/70 shadow-lg flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>شروع مستقیم بخش تعقیب قوطی غول‌پیکر!</span>
                </button>

                <div className="grid grid-cols-3 gap-2 mt-1">
                  <button
                    onClick={() => startGame(unlockedStageIdx, false)}
                    className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-600 transition cursor-pointer"
                  >
                    ادامه
                  </button>
                  <button
                    onClick={() => {
                      setShowSettings(true);
                      setShowGuide(false);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-600 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-cyan-300" />
                    <span>تنظیمات</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowGuide(true);
                      setShowSettings(false);
                    }}
                    className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-600 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <HelpCircle className="w-4 h-4 text-amber-300" />
                    <span>راهنما</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 3D Character Angle & Animation Switcher (matches top-left of reference poster!) */}
            <div className="w-full max-w-sm bg-slate-950/80 border border-blue-400/40 rounded-2xl p-4 backdrop-blur-md pointer-events-auto">
              <div className="text-xs font-extrabold text-cyan-300 mb-2">
                شخصیت اصلی (قهرمان نوشابه‌ای) — زاویه دوربین و انیمیشن:
              </div>
              <div className="grid grid-cols-4 gap-1.5 mb-2.5">
                {(
                  [
                    { id: 'front', label: 'نمای جلو' },
                    { id: 'back', label: 'نمای پشت' },
                    { id: 'side', label: 'نمای بغل' },
                    { id: 'orbit', label: 'چرخش ۳۶۰' },
                  ] as const
                ).map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setMenuHeroView(v.id)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition ${
                      menuHeroView === v.id
                        ? 'bg-blue-600 border-white text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'run', label: 'دویدن' },
                    { id: 'jump', label: 'پریدن' },
                    { id: 'slide', label: 'سرخوردن' },
                    { id: 'dash', label: 'دش سرعتی' },
                    { id: 'hit', label: 'آسیب دیدن' },
                    { id: 'death', label: 'مرگ' },
                  ] as const
                ).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setMenuHeroAnim(a.id)}
                    className={`py-1 px-2 rounded-lg text-[11px] font-bold border transition ${
                      menuHeroAnim === a.id
                        ? 'bg-cyan-500 border-white text-slate-950'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Feature Strip (Matches bottom bar of reference poster) */}
          <div className="hidden sm:flex items-center justify-between gap-4 bg-slate-950/80 border border-white/15 rounded-2xl px-5 py-2.5 text-xs text-slate-200 backdrop-blur-sm">
            <span>🎮 گرافیک رترو سه‌بعدی (PS1)</span>
            <span>·</span>
            <span>🔊 موسیقی و صداهای اختصاصی</span>
            <span>·</span>
            <span>🏙️ ۴ مرحله متنوع</span>
            <span>·</span>
            <span>🏁 سیستم چک‌پوینت</span>
            <span>·</span>
            <span>🥫 تعقیب قوطی غول‌پیکر با دوربین روبه‌رو</span>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SETTINGS MODAL (تنظیمات)                                          */}
      {/* ================================================================= */}
      {showSettings && (
        <div className="absolute inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border-2 border-blue-400 rounded-3xl p-6 shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-4">تنظیمات بازی</h2>
            <div className="space-y-3 text-sm">
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800 cursor-pointer">
                <span>افکت خطوط تلویزیون رترو (PS1 Scanlines)</span>
                <input
                  type="checkbox"
                  checked={retroScanlines}
                  onChange={(e) => setRetroScanlines(e.target.checked)}
                  className="w-5 h-5 accent-blue-500"
                />
              </label>
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800 cursor-pointer">
                <span>فیلتر پیکسلی کنسول دهه ۹۰</span>
                <input
                  type="checkbox"
                  checked={pixelScale}
                  onChange={(e) => setPixelScale(e.target.checked)}
                  className="w-5 h-5 accent-blue-500"
                />
              </label>
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800 cursor-pointer">
                <span>نمایش دکمه‌های لمسی روی صفحه</span>
                <input
                  type="checkbox"
                  checked={showTouchControls}
                  onChange={(e) => setShowTouchControls(e.target.checked)}
                  className="w-5 h-5 accent-blue-500"
                />
              </label>
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800 cursor-pointer">
                <span>قطع صدا و موسیقی</span>
                <input
                  type="checkbox"
                  checked={isMuted}
                  onChange={toggleAudioMute}
                  className="w-5 h-5 accent-blue-500"
                />
              </label>
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="mt-6 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black transition"
            >
              بستن و ذخیره
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* GUIDE MODAL (راهنما)                                              */}
      {/* ================================================================= */}
      {showGuide && (
        <div className="absolute inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border-2 border-blue-400 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-black text-white mb-3">راهنمای بازی و کنترل‌ها</h2>
            <div className="grid grid-cols-2 gap-2.5 text-xs sm:text-sm mb-4">
              <div className="p-3 rounded-xl bg-slate-800 border border-slate-700">
                <div className="font-black text-cyan-300">حرکت چپ و راست</div>
                <div className="text-slate-300 mt-1">کلیدهای A / D یا فلش‌های چپ و راست</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-800 border border-slate-700">
                <div className="font-black text-cyan-300">پرش از چاله و ماشین</div>
                <div className="text-slate-300 mt-1">کلید Space یا W یا فلش بالا</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-800 border border-slate-700">
                <div className="font-black text-amber-300">سرخوردن زیر کامیون</div>
                <div className="text-slate-300 mt-1">کلید S یا فلش پایین</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-800 border border-slate-700">
                <div className="font-black text-emerald-300">دش / افزایش سرعت</div>
                <div className="text-slate-300 mt-1">کلید Shift (با جمع‌آوری قوطی شارژ می‌شود)</div>
              </div>
            </div>
            <div className="space-y-2 text-xs sm:text-sm text-slate-200 bg-slate-950/70 p-4 rounded-2xl border border-blue-500/30">
              <p>
                🥫 <strong>تعقیب قوطی غول‌پیکر FIZZ-X:</strong> در اواسط هر مرحله، قوطی غول‌پیکر از پشت سر ظاهر می‌شود و دوربین ۱۸۰ درجه به جلوی قهرمان می‌چرخد تا در حالی که به سمت دوربین می‌دوید از موانع فرار کنید!
              </p>
              <p>
                🚚 <strong>بخش کامیون نوشابه:</strong> وقتی کامیون آبی FIZZ-X جاده را مسدود کرد، با فشردن کلید <strong>S (سرخوردن)</strong> از زیر تریلر کامیون عبور کنید.
              </p>
              <p>
                🕳️ <strong>چاله‌های راه‌سازی:</strong> با فشردن <strong>Space (پرش)</strong> از روی گودال‌ها و ماشین‌ها بپرید.
              </p>
            </div>
            <button
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black transition"
            >
              متوجه شدم!
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* PAUSE MENU (بازی متوقف شد)                                        */}
      {/* ================================================================= */}
      {screenState === 'PAUSED' && (
        <div className="absolute inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border-2 border-blue-400 rounded-3xl p-6 text-center shadow-2xl">
            <h2 className="text-3xl font-black text-white mb-6 retro-text-shadow">
              بازی متوقف شد
            </h2>
            <div className="flex flex-col gap-3">
              <button
                onClick={togglePause}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-lg transition"
              >
                ادامه
              </button>
              <button
                onClick={() => startGame(selectedStageIdx, false)}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-lg transition"
              >
                شروع دوباره
              </button>
              <button
                onClick={() => {
                  soundEngine.stopMusic();
                  engineRef.current.screen = 'MENU';
                  setScreenState('MENU');
                  loadStageIntoScene(selectedStageIdx, false);
                  engineRef.current.cameraMode = 'MENU_CAMERA';
                }}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition"
              >
                بازگشت به منو
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* GAME OVER SCREEN (باختی!)                                         */}
      {/* ================================================================= */}
      {screenState === 'GAME_OVER' && (
        <div className="absolute inset-0 z-40 bg-red-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border-2 border-red-500 rounded-3xl p-6 text-center shadow-2xl">
            <h2 className="text-4xl font-black text-red-500 mb-2 retro-text-shadow">
              باختی!
            </h2>
            <p className="text-sm text-slate-300 mb-5">
              مرحله {currentStage.code}: {currentStage.titleFa}
            </p>

            <div className="bg-slate-950/90 rounded-2xl p-4 mb-6 space-y-2.5 text-sm border border-white/10">
              <div className="flex justify-between">
                <span className="text-slate-400">قوطی‌های جمع‌شده:</span>
                <span className="font-black text-cyan-300">{toPersianDigits(cansCollected)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">مسافت طی‌شده:</span>
                <span className="font-black text-white">{toPersianDigits(distanceMeters)} متر</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">زمان باقی‌مانده:</span>
                <span className="font-arcade text-amber-300" dir="ltr">
                  {formatRetroTimer(timeLeft)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => startGame(selectedStageIdx, false)}
                className="w-full py-3.5 rounded-xl bg-gradient-to-l from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white font-black text-lg flex items-center justify-center gap-2 shadow-lg transition"
              >
                <RotateCcw className="w-5 h-5" />
                <span>دوباره تلاش کن</span>
              </button>
              <button
                onClick={() => {
                  engineRef.current.screen = 'MENU';
                  setScreenState('MENU');
                  loadStageIntoScene(selectedStageIdx, false);
                  engineRef.current.cameraMode = 'MENU_CAMERA';
                }}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition"
              >
                بازگشت به منو
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* STAGE COMPLETE SCREEN (مرحله کامل شد!)                            */}
      {/* ================================================================= */}
      {screenState === 'STAGE_COMPLETE' && (
        <div className="absolute inset-0 z-40 bg-blue-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border-2 border-cyan-400 rounded-3xl p-6 text-center shadow-2xl">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-amber-400/20 border border-amber-400 flex items-center justify-center text-amber-300">
              <Trophy className="w-8 h-8" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white mb-1 retro-blue-glow">
              مرحله کامل شد!
            </h2>
            <p className="text-sm text-cyan-300 mb-5">
              مرحله {currentStage.code}: {currentStage.titleFa}
            </p>

            <div className="bg-slate-950/90 rounded-2xl p-4 mb-6 space-y-2.5 text-sm border border-cyan-500/30">
              <div className="flex justify-between">
                <span className="text-slate-400">قوطی‌های جمع‌شده:</span>
                <span className="font-black text-cyan-300">{toPersianDigits(cansCollected)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">زمان باقی‌مانده:</span>
                <span className="font-arcade text-amber-300" dir="ltr">
                  {formatRetroTimer(timeLeft)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">مسافت:</span>
                <span className="font-black text-white">
                  {toPersianDigits((currentStage.length / 1000).toFixed(1))} کیلومتر
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">جان باقی‌مانده:</span>
                <span className="font-black text-emerald-400">{toPersianDigits(lives)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  const nextIdx = (selectedStageIdx + 1) % STAGES.length;
                  startGame(nextIdx, false);
                }}
                className="w-full py-3.5 rounded-xl bg-gradient-to-l from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-lg flex items-center justify-center gap-2 shadow-lg transition"
              >
                <Flag className="w-5 h-5" />
                <span>مرحله بعد</span>
              </button>
              <button
                onClick={() => {
                  engineRef.current.screen = 'MENU';
                  setScreenState('MENU');
                  loadStageIntoScene(selectedStageIdx, false);
                  engineRef.current.cameraMode = 'MENU_CAMERA';
                }}
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition"
              >
                بازگشت به منو
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
