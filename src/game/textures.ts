import * as THREE from 'three';

function makeRetroTexture(
  width: number,
  height: number,
  drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeatX: number = 1,
  repeatY: number = 1
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  drawFn(ctx, width, height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export interface GameTextures {
  fizzCanSide: THREE.CanvasTexture;
  fizzCanTop: THREE.CanvasTexture;
  roadAsphalt: THREE.CanvasTexture;
  sidewalkTile: THREE.CanvasTexture;
  grassLawn: THREE.CanvasTexture;
  suburbanWallBlue: THREE.CanvasTexture;
  suburbanWallCream: THREE.CanvasTexture;
  suburbanWallBrick: THREE.CanvasTexture;
  cityBuildingGlass: THREE.CanvasTexture;
  industrialWall: THREE.CanvasTexture;
  truckTrailer: THREE.CanvasTexture;
  hazardStripes: THREE.CanvasTexture;
  fizzBillboard: THREE.CanvasTexture;
  chestEmblem: THREE.CanvasTexture;
}

let cachedTextures: GameTextures | null = null;

export function getGameTextures(): GameTextures {
  if (cachedTextures) return cachedTextures;

  // 1. FIZZ-X Can Side Texture (Used on collectibles & the Giant Chasing Can)
  const fizzCanSide = makeRetroTexture(256, 256, (ctx, w, h) => {
    // Deep electric royal blue background
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#00257a');
    grad.addColorStop(0.25, '#0047cc');
    grad.addColorStop(0.5, '#1a75ff');
    grad.addColorStop(0.75, '#0047cc');
    grad.addColorStop(1, '#00257a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Top & bottom silver metallic rims
    ctx.fillStyle = '#d8e2ef';
    ctx.fillRect(0, 0, w, 14);
    ctx.fillRect(0, h - 14, w, 14);
    ctx.fillStyle = '#8fa3bf';
    ctx.fillRect(0, 14, w, 4);
    ctx.fillRect(0, h - 18, w, 4);

    // Dynamic original Red-White-Blue FIZZ-X emblem circle in center
    const cx = w * 0.5;
    const cy = h * 0.44;
    const r = 64;

    // Outer silver ring
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
    ctx.fillStyle = '#f0f5ff';
    ctx.fill();

    // Red top wave
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#e6192e';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 1.1);

    // White center ribbon wave
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - 10);
    ctx.quadraticCurveTo(cx - r * 0.3, cy - 34, cx, cy - 6);
    ctx.quadraticCurveTo(cx + r * 0.4, cy + 20, cx + r, cy - 8);
    ctx.lineTo(cx + r, cy + 20);
    ctx.quadraticCurveTo(cx + r * 0.4, cy + 44, cx, cy + 18);
    ctx.quadraticCurveTo(cx - r * 0.3, cy - 8, cx - r, cy + 16);
    ctx.closePath();
    ctx.fill();

    // Deep blue lower half
    ctx.fillStyle = '#002b80';
    ctx.beginPath();
    ctx.moveTo(cx - r, cy + 16);
    ctx.quadraticCurveTo(cx - r * 0.3, cy - 8, cx, cy + 18);
    ctx.quadraticCurveTo(cx + r * 0.4, cy + 44, cx + r, cy + 20);
    ctx.lineTo(cx + r, cy + r);
    ctx.lineTo(cx - r, cy + r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Bold "FIZZ-X" angled arcade text
    ctx.save();
    ctx.translate(cx, h * 0.79);
    ctx.rotate(-0.08);
    ctx.font = '900 40px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#001238';
    ctx.strokeText('FIZZ-X', 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('FIZZ-X', 0, 0);
    ctx.restore();

    // Condensation water droplets (retro pixel dots)
    ctx.fillStyle = 'rgba(200, 235, 255, 0.7)';
    for (let i = 0; i < 36; i++) {
      const dx = ((i * 67) % (w - 24)) + 12;
      const dy = ((i * 43) % (h - 40)) + 20;
      ctx.fillRect(dx, dy, 4, 4);
    }
  });

  // 2. Can Top/Bottom Aluminum Lid
  const fizzCanTop = makeRetroTexture(128, 128, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    ctx.fillStyle = '#c4d0e0';
    ctx.fillRect(0, 0, w, h);

    const rings = [
      { r: 58, color: '#9aa9bd' },
      { r: 52, color: '#e6eef7' },
      { r: 44, color: '#b0bfd4' },
      { r: 38, color: '#d5e0ed' }
    ];
    rings.forEach((ring) => {
      ctx.beginPath();
      ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
      ctx.fillStyle = ring.color;
      ctx.fill();
    });

    // Pull tab
    ctx.fillStyle = '#758599';
    ctx.fillRect(cx - 10, cy - 22, 20, 32);
    ctx.fillStyle = '#d5e0ed';
    ctx.fillRect(cx - 6, cy - 18, 12, 10);
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(cx - 8, cy + 4, 16, 12);
  });

  // 3. Road Asphalt Texture
  const roadAsphalt = makeRetroTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2d313b';
    ctx.fillRect(0, 0, w, h);

    // Pixelated asphalt grain
    for (let i = 0; i < 650; i++) {
      const x = (i * 37) % w;
      const y = (i * 73) % h;
      ctx.fillStyle = i % 2 === 0 ? '#363b47' : '#232730';
      ctx.fillRect(x, y, 4, 4);
    }

    // Left & right white shoulder lines
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(10, 0, 6, h);
    ctx.fillRect(w - 16, 0, 6, h);

    // Two lane dividers (3 lanes total)
    ctx.fillStyle = '#facc15';
    const lane1 = Math.floor(w / 3);
    const lane2 = Math.floor((w * 2) / 3);
    for (let y = 16; y < h; y += 64) {
      ctx.fillRect(lane1 - 3, y, 6, 34);
      ctx.fillRect(lane2 - 3, y, 6, 34);
    }
  }, 1, 1);

  // 4. Sidewalk Tile
  const sidewalkTile = makeRetroTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, w - 4, h / 2 - 2);
    ctx.strokeRect(2, h / 2 + 2, w - 4, h / 2 - 4);
  }, 1, 8);

  // 5. Grass Lawn
  const grassLawn = makeRetroTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#228b22';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) {
      const x = (i * 29) % w;
      const y = (i * 53) % h;
      ctx.fillStyle = i % 3 === 0 ? '#2ea82e' : '#1b731b';
      ctx.fillRect(x, y, 4, 4);
    }
  }, 4, 8);

  // 6. Suburban House Facades
  const drawHouseFacade = (ctx: CanvasRenderingContext2D, w: number, h: number, wallColor: string, trimColor: string) => {
    ctx.fillStyle = wallColor;
    ctx.fillRect(0, 0, w, h);
    // Horizontal siding lines
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (let y = 0; y < h; y += 8) {
      ctx.fillRect(0, y, w, 2);
    }
    // Windows
    const drawWin = (wx: number, wy: number) => {
      ctx.fillStyle = trimColor;
      ctx.fillRect(wx - 3, wy - 3, 34, 38);
      ctx.fillStyle = '#1e3a5f';
      ctx.fillRect(wx, wy, 28, 32);
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(wx + 2, wy + 2, 11, 13);
      ctx.fillRect(wx + 15, wy + 2, 11, 13);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(wx + 2, wy + 17, 11, 13);
      ctx.fillRect(wx + 15, wy + 17, 11, 13);
    };
    drawWin(20, 22);
    drawWin(76, 22);
    drawWin(20, 74);
    // Front Door
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(78, 72, 28, 56);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(100, 98, 4, 4);
  };

  const suburbanWallBlue = makeRetroTexture(128, 128, (ctx, w, h) => drawHouseFacade(ctx, w, h, '#60a5fa', '#f8fafc'));
  const suburbanWallCream = makeRetroTexture(128, 128, (ctx, w, h) => drawHouseFacade(ctx, w, h, '#fde68a', '#78350f'));
  const suburbanWallBrick = makeRetroTexture(128, 128, (ctx, w, h) => drawHouseFacade(ctx, w, h, '#b91c1c', '#f1f5f9'));

  // 7. City Building Glass & Windows
  const cityBuildingGlass = makeRetroTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, w, h);
    for (let r = 10; r < h - 24; r += 26) {
      for (let c = 10; c < w - 16; c += 28) {
        const lit = (r * 7 + c * 3) % 5 !== 0;
        ctx.fillStyle = lit ? ((r + c) % 4 === 0 ? '#fde047' : '#38bdf8') : '#0f172a';
        ctx.fillRect(c, r, 18, 18);
      }
    }
  });

  // 8. Industrial Soda Factory Wall
  const industrialWall = makeRetroTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(0, 48, w, 32);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FIZZ-X PLANT', w / 2, 70);
  });

  // 9. FIZZ-X Delivery Truck Trailer Texture
  const truckTrailer = makeRetroTexture(256, 128, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#002b80');
    grad.addColorStop(0.5, '#0055ff');
    grad.addColorStop(1, '#001f60');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Silver border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, w - 8, h - 8);

    // Red-white wave stripe
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(10, h - 34, w - 20, 14);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(10, h - 20, w - 20, 10);

    // Bold FIZZ-X Logo
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 44px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FIZZ-X COLA', w / 2, 62);
  });

  // 10. Hazard Stripes (Construction barriers & Truck slide bar)
  const hazardStripes = makeRetroTexture(128, 32, (ctx, w, h) => {
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#111827';
    for (let x = -32; x < w + 32; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 16, 0);
      ctx.lineTo(x, h);
      ctx.lineTo(x - 16, h);
      ctx.closePath();
      ctx.fill();
    }
  });

  // 11. FIZZ-X Billboard
  const fizzBillboard = makeRetroTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#003399';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(54, 64, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 40px "Chakra Petch", sans-serif';
    ctx.fillText('FIZZ-X', 105, 62);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px "Vazirmatn", sans-serif';
    ctx.fillText('طعم هیجان و سرعت!', 105, 96);
  });

  // 12. Superhero Chest Emblem
  const chestEmblem = makeRetroTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#0044cc';
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 46, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, 40, Math.PI, Math.PI * 2);
    ctx.fillStyle = '#e6192e';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI);
    ctx.fillStyle = '#002b80';
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 42, cy - 7, 84, 14);
  });

  cachedTextures = {
    fizzCanSide,
    fizzCanTop,
    roadAsphalt,
    sidewalkTile,
    grassLawn,
    suburbanWallBlue,
    suburbanWallCream,
    suburbanWallBrick,
    cityBuildingGlass,
    industrialWall,
    truckTrailer,
    hazardStripes,
    fizzBillboard,
    chestEmblem,
  };

  return cachedTextures;
}
