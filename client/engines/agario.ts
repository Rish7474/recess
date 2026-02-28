export interface CellData {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  mass: number;
  color: string;
}

export interface FoodData {
  id: string;
  x: number;
  y: number;
  color: string;
}

export interface EjectedData {
  id: string;
  x: number;
  y: number;
  mass: number;
  color: string;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  mass: number;
}

export interface AgarioClientState {
  cells: CellData[];
  food: FoodData[];
  ejected: EjectedData[];
  leaderboard: LeaderboardEntry[];
  timeElapsed: number;
  duration: number;
  worldSize: number;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  targetX: number;
  targetY: number;
  targetZoom: number;
}

export interface Theme {
  background: string;
  accent: string;
  grid: string;
}

// Interpolated positions in WORLD space for smooth rendering
const interpCells = new Map<string, { x: number; y: number; mass: number }>();

export function clearInterpolation() {
  interpCells.clear();
}

export function createCamera(worldSize: number): Camera {
  return {
    x: worldSize / 2,
    y: worldSize / 2,
    zoom: 1,
    targetX: worldSize / 2,
    targetY: worldSize / 2,
    targetZoom: 1,
  };
}

export function updateCamera(
  camera: Camera,
  state: AgarioClientState | null,
  mySocketId: string
) {
  if (!state) return;

  const myCells = state.cells.filter((c) => c.ownerId === mySocketId);
  if (myCells.length === 0) return;

  let totalMass = 0;
  let cx = 0;
  let cy = 0;
  for (const cell of myCells) {
    // Use interpolated world positions if available
    const interp = interpCells.get(cell.id);
    const px = interp ? interp.x : cell.x;
    const py = interp ? interp.y : cell.y;
    cx += px * cell.mass;
    cy += py * cell.mass;
    totalMass += cell.mass;
  }

  if (totalMass > 0) {
    camera.targetX = cx / totalMass;
    camera.targetY = cy / totalMass;
  }

  camera.targetZoom = Math.max(0.3, 1 / (1 + totalMass / 300));

  const lerpFactor = 0.1;
  camera.x += (camera.targetX - camera.x) * lerpFactor;
  camera.y += (camera.targetY - camera.y) * lerpFactor;
  camera.zoom += (camera.targetZoom - camera.zoom) * lerpFactor;
}

function worldToScreen(
  wx: number,
  wy: number,
  camera: Camera,
  screenW: number,
  screenH: number
): [number, number] {
  const sx = (wx - camera.x) * camera.zoom + screenW / 2;
  const sy = (wy - camera.y) * camera.zoom + screenH / 2;
  return [sx, sy];
}

function radiusFromMass(mass: number): number {
  return Math.sqrt(mass) * 4;
}

export function render(
  ctx: CanvasRenderingContext2D,
  state: AgarioClientState | null,
  camera: Camera,
  mySocketId: string,
  theme: Theme,
  _timestamp: number,
  playerNames?: Map<string, string>
) {
  const w = ctx.canvas.width / (window.devicePixelRatio || 1);
  const h = ctx.canvas.height / (window.devicePixelRatio || 1);

  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, w, h);

  if (!state) return;

  const names = playerNames || new Map<string, string>();

  drawGrid(ctx, camera, state.worldSize, w, h, theme);
  drawWorldBorder(ctx, camera, state.worldSize, w, h);
  drawFood(ctx, state.food, camera, w, h);
  drawEjected(ctx, state.ejected, camera, w, h);
  drawCells(ctx, state.cells, camera, mySocketId, w, h, names);
  drawHUD(ctx, state, mySocketId, w, h, theme, names);
  drawMinimap(ctx, state, mySocketId, w, h);
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  worldSize: number,
  w: number,
  h: number,
  theme: Theme
) {
  const gridSize = 100;
  const scaledGrid = gridSize * camera.zoom;

  if (scaledGrid < 8) return;

  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.4;

  const [startX, startY] = worldToScreen(0, 0, camera, w, h);
  const [endX, endY] = worldToScreen(worldSize, worldSize, camera, w, h);

  const firstGridX =
    startX - ((startX % scaledGrid) + scaledGrid) % scaledGrid;
  const firstGridY =
    startY - ((startY % scaledGrid) + scaledGrid) % scaledGrid;

  ctx.beginPath();
  for (let x = firstGridX; x <= Math.min(endX, w); x += scaledGrid) {
    if (x < Math.max(startX, 0)) continue;
    ctx.moveTo(x, Math.max(startY, 0));
    ctx.lineTo(x, Math.min(endY, h));
  }
  for (let y = firstGridY; y <= Math.min(endY, h); y += scaledGrid) {
    if (y < Math.max(startY, 0)) continue;
    ctx.moveTo(Math.max(startX, 0), y);
    ctx.lineTo(Math.min(endX, w), y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawWorldBorder(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  worldSize: number,
  w: number,
  h: number
) {
  const [x0, y0] = worldToScreen(0, 0, camera, w, h);
  const [x1, y1] = worldToScreen(worldSize, worldSize, camera, w, h);

  ctx.strokeStyle = "rgba(255, 50, 50, 0.5)";
  ctx.lineWidth = 3;
  ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
}

function drawFood(
  ctx: CanvasRenderingContext2D,
  food: FoodData[],
  camera: Camera,
  w: number,
  h: number
) {
  const margin = 50;
  for (const f of food) {
    const [sx, sy] = worldToScreen(f.x, f.y, camera, w, h);
    if (sx < -margin || sx > w + margin || sy < -margin || sy > h + margin)
      continue;

    const r = Math.max(2, 5 * camera.zoom);
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = f.color;
    ctx.fill();
  }
}

function drawEjected(
  ctx: CanvasRenderingContext2D,
  ejected: EjectedData[],
  camera: Camera,
  w: number,
  h: number
) {
  for (const e of ejected) {
    const [sx, sy] = worldToScreen(e.x, e.y, camera, w, h);
    if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) continue;

    const r = Math.max(3, radiusFromMass(e.mass) * camera.zoom);
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = e.color;
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawCells(
  ctx: CanvasRenderingContext2D,
  cells: CellData[],
  camera: Camera,
  mySocketId: string,
  w: number,
  h: number,
  playerNames: Map<string, string>
) {
  const sorted = [...cells].sort((a, b) => a.mass - b.mass);

  for (const cell of sorted) {
    // Interpolate in world-space to avoid camera double-lerp flicker
    let interp = interpCells.get(cell.id);
    if (!interp) {
      interp = { x: cell.x, y: cell.y, mass: cell.mass };
      interpCells.set(cell.id, interp);
    }
    interp.x += (cell.x - interp.x) * 0.25;
    interp.y += (cell.y - interp.y) * 0.25;
    interp.mass += (cell.mass - interp.mass) * 0.15;

    // Convert interpolated world position to screen
    const [drawX, drawY] = worldToScreen(interp.x, interp.y, camera, w, h);
    const drawR = Math.max(4, radiusFromMass(interp.mass) * camera.zoom);

    if (drawX < -drawR * 2 || drawX > w + drawR * 2 || drawY < -drawR * 2 || drawY > h + drawR * 2)
      continue;

    const isMine = cell.ownerId === mySocketId;

    if (isMine) {
      ctx.save();
      ctx.shadowColor = cell.color;
      ctx.shadowBlur = 15;
    }

    ctx.beginPath();
    ctx.arc(drawX, drawY, drawR, 0, Math.PI * 2);
    ctx.fillStyle = cell.color;
    ctx.fill();

    ctx.strokeStyle = isMine ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.3)";
    ctx.lineWidth = Math.max(2, drawR * 0.05);
    ctx.stroke();

    if (isMine) {
      ctx.restore();
    }

    if (drawR > 15) {
      const fontSize = Math.max(10, Math.min(drawR * 0.4, 24));
      ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 2;
      const name = playerNames.get(cell.ownerId);
      const label = isMine ? (name || "You") : (name || cell.ownerId.slice(0, 6));
      ctx.strokeText(label, drawX, drawY);
      ctx.fillText(label, drawX, drawY);

      if (drawR > 25) {
        const massFontSize = Math.max(8, fontSize * 0.6);
        ctx.font = `${massFontSize}px system-ui, sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fillText(
          Math.round(interp.mass).toString(),
          drawX,
          drawY + fontSize * 0.7
        );
      }
    }
  }

  // Clean up stale interpolation entries
  const activeIds = new Set(cells.map((c) => c.id));
  for (const [id] of interpCells) {
    if (!activeIds.has(id)) interpCells.delete(id);
  }
}

function drawHUD(
  ctx: CanvasRenderingContext2D,
  state: AgarioClientState,
  mySocketId: string,
  w: number,
  h: number,
  theme: Theme,
  playerNames: Map<string, string>
) {
  const remaining = Math.max(0, state.duration * 1000 - state.timeElapsed);
  const secs = Math.ceil(remaining / 1000);
  const mins = Math.floor(secs / 60);
  const s = secs % 60;
  const timeText = `${mins}:${s.toString().padStart(2, "0")}`;

  ctx.fillStyle = secs <= 10 ? theme.accent : "rgba(255,255,255,0.5)";
  ctx.font = "bold 20px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText(timeText, w - 16, 16);

  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "bold 11px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("LEADERBOARD", w - 16, 46);

  ctx.font = "13px system-ui, sans-serif";
  for (let i = 0; i < Math.min(state.leaderboard.length, 5); i++) {
    const entry = state.leaderboard[i];
    const isMine = entry.id === mySocketId;
    ctx.fillStyle = isMine ? theme.accent : "rgba(255,255,255,0.5)";
    const name = isMine
      ? (playerNames.get(mySocketId) || "You")
      : (entry.name || playerNames.get(entry.id) || entry.id.slice(0, 6));
    ctx.fillText(
      `${i + 1}. ${name} — ${entry.mass}`,
      w - 16,
      62 + i * 18
    );
  }

  let myMass = 0;
  for (const c of state.cells) {
    if (c.ownerId === mySocketId) myMass += c.mass;
  }
  ctx.fillStyle = theme.accent;
  ctx.font = "bold 22px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(Math.round(myMass).toLocaleString(), w / 2, h - 30);

  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillText("MASS", w / 2, h - 14);
}

function drawMinimap(
  ctx: CanvasRenderingContext2D,
  state: AgarioClientState,
  mySocketId: string,
  w: number,
  h: number
) {
  const size = Math.min(120, Math.min(w, h) * 0.2);
  const padding = 12;
  const mx = w - size - padding;
  const my = h - size - padding;
  const scale = size / state.worldSize;

  // Background
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(mx, my, size, size);
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 1;
  ctx.strokeRect(mx, my, size, size);

  // Other cells as dots
  for (const cell of state.cells) {
    const dotX = mx + cell.x * scale;
    const dotY = my + cell.y * scale;
    const dotR = Math.max(1.5, radiusFromMass(cell.mass) * scale);

    ctx.beginPath();
    ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
    ctx.fillStyle =
      cell.ownerId === mySocketId ? "#ffffff" : cell.color;
    ctx.fill();
  }
}

export function drawMobileButtons(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  splitPressed: boolean,
  ejectPressed: boolean
) {
  const btnRadius = 28;
  const bottomOffset = 70;

  // Split button (right side)
  const splitX = w - 60;
  const splitY = h - bottomOffset;
  ctx.beginPath();
  ctx.arc(splitX, splitY, btnRadius, 0, Math.PI * 2);
  ctx.fillStyle = splitPressed
    ? "rgba(255,255,255,0.35)"
    : "rgba(255,255,255,0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("SPLIT", splitX, splitY);

  // Eject button (left side)
  const ejectX = 60;
  const ejectY = h - bottomOffset;
  ctx.beginPath();
  ctx.arc(ejectX, ejectY, btnRadius, 0, Math.PI * 2);
  ctx.fillStyle = ejectPressed
    ? "rgba(255,255,255,0.35)"
    : "rgba(255,255,255,0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "bold 13px system-ui, sans-serif";
  ctx.fillText("EJECT", ejectX, ejectY);
}

export function hitTestMobileButton(
  x: number,
  y: number,
  w: number,
  h: number
): "split" | "eject" | null {
  const btnRadius = 35; // slightly larger hit area
  const bottomOffset = 70;

  const splitX = w - 60;
  const splitY = h - bottomOffset;
  if (Math.hypot(x - splitX, y - splitY) < btnRadius) return "split";

  const ejectX = 60;
  const ejectY = h - bottomOffset;
  if (Math.hypot(x - ejectX, y - ejectY) < btnRadius) return "eject";

  return null;
}
