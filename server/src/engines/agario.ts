import { GameEngine, BaseGameState, PlayerInput } from "./types";

interface Cell {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  mass: number;
  vx: number;
  vy: number;
  color: string;
  splitTime: number;
}

interface Food {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
}

interface EjectedMass {
  id: string;
  x: number;
  y: number;
  mass: number;
  vx: number;
  vy: number;
  color: string;
}

export interface AgarioState extends BaseGameState {
  cells: Cell[];
  food: Food[];
  ejected: EjectedMass[];
  playerTargets: Map<string, { x: number; y: number }>;
  playerColors: Map<string, string>;
  worldSize: number;
  nextId: number;
  baseSpeed: number;
  foodCount: number;
}

const PLAYER_COLORS = [
  "#ff3366", "#33ff66", "#3366ff", "#ff9933", "#9933ff",
  "#33ffcc", "#ff3399", "#66ff33", "#3399ff", "#ffcc33",
  "#cc33ff", "#33ffff", "#ff6633", "#33ff99", "#6633ff",
  "#ffff33",
];

const MIN_SPLIT_MASS = 36;
const MAX_CELLS_PER_PLAYER = 16;
const MERGE_COOLDOWN_MS = 10000;
const EJECT_MASS = 14;
const EJECT_SPEED = 25;
const EJECT_LOSS = 16;
const MASS_DECAY_THRESHOLD = 100;
const MASS_DECAY_RATE = 0.002;
const FOOD_MASS = 1;
const START_MASS = 20;
const EAT_RATIO = 1.1;

function radiusFromMass(mass: number): number {
  return Math.sqrt(mass) * 4;
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function randomColor(): string {
  return PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
}

function spawnFood(state: AgarioState): Food {
  const id = `f${state.nextId++}`;
  return {
    id,
    x: Math.random() * state.worldSize,
    y: Math.random() * state.worldSize,
    radius: 5,
    color: randomColor(),
  };
}

function spawnPlayerCell(state: AgarioState, playerId: string): Cell {
  let color = state.playerColors.get(playerId);
  if (!color) {
    color = PLAYER_COLORS[state.playerColors.size % PLAYER_COLORS.length];
    state.playerColors.set(playerId, color);
  }
  return {
    id: `c${state.nextId++}`,
    ownerId: playerId,
    x: Math.random() * state.worldSize * 0.6 + state.worldSize * 0.2,
    y: Math.random() * state.worldSize * 0.6 + state.worldSize * 0.2,
    mass: START_MASS,
    vx: 0,
    vy: 0,
    color,
    splitTime: 0,
  };
}

export const agarioEngine: GameEngine<AgarioState> = {
  initState(params, _playerCount, duration) {
    const worldSize = (params.world_size as number) || 5000;
    const foodCount = (params.food_count as number) || 400;
    const baseSpeed = (params.base_speed as number) || 3;

    const state: AgarioState = {
      cells: [],
      food: [],
      ejected: [],
      playerTargets: new Map(),
      playerColors: new Map(),
      worldSize,
      nextId: 1,
      baseSpeed,
      foodCount,
      timeElapsed: 0,
      duration,
    };

    for (let i = 0; i < foodCount; i++) {
      state.food.push(spawnFood(state));
    }

    return state;
  },

  onPlayerJoin(state, playerId) {
    const existing = state.cells.find((c) => c.ownerId === playerId);
    if (!existing) {
      state.cells.push(spawnPlayerCell(state, playerId));
      state.playerTargets.set(playerId, {
        x: state.worldSize / 2,
        y: state.worldSize / 2,
      });
    }
  },

  onPlayerLeave(state, playerId) {
    state.cells = state.cells.filter((c) => c.ownerId !== playerId);
    state.playerTargets.delete(playerId);
  },

  processInput(state, playerId, input) {
    if (!state.cells.some((c) => c.ownerId === playerId)) {
      state.cells.push(spawnPlayerCell(state, playerId));
    }

    if (input.type === "move") {
      state.playerTargets.set(playerId, { x: input.x, y: input.y });
    } else if (input.type === "split") {
      const target = state.playerTargets.get(playerId);
      if (!target) return;

      const playerCells = state.cells.filter((c) => c.ownerId === playerId);
      if (playerCells.length >= MAX_CELLS_PER_PLAYER) return;

      const toSplit = playerCells.filter((c) => c.mass >= MIN_SPLIT_MASS);
      const canAdd = MAX_CELLS_PER_PLAYER - playerCells.length;

      for (let i = 0; i < Math.min(toSplit.length, canAdd); i++) {
        const cell = toSplit[i];
        const halfMass = cell.mass / 2;
        cell.mass = halfMass;

        const dx = target.x - cell.x;
        const dy = target.y - cell.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / d;
        const ny = dy / d;
        const splitSpeed = 18;

        const newCell: Cell = {
          id: `c${state.nextId++}`,
          ownerId: playerId,
          x: cell.x + nx * radiusFromMass(halfMass),
          y: cell.y + ny * radiusFromMass(halfMass),
          mass: halfMass,
          vx: nx * splitSpeed,
          vy: ny * splitSpeed,
          color: cell.color,
          splitTime: state.timeElapsed,
        };
        state.cells.push(newCell);
      }
    } else if (input.type === "eject") {
      const target = state.playerTargets.get(playerId);
      if (!target) return;

      const playerCells = state.cells.filter(
        (c) => c.ownerId === playerId && c.mass > EJECT_LOSS + 10
      );

      for (const cell of playerCells) {
        cell.mass -= EJECT_LOSS;

        const dx = target.x - cell.x;
        const dy = target.y - cell.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / d;
        const ny = dy / d;

        state.ejected.push({
          id: `e${state.nextId++}`,
          x: cell.x + nx * (radiusFromMass(cell.mass) + 10),
          y: cell.y + ny * (radiusFromMass(cell.mass) + 10),
          mass: EJECT_MASS,
          vx: nx * EJECT_SPEED,
          vy: ny * EJECT_SPEED,
          color: cell.color,
        });
      }
    }
  },

  tick(state, elapsedMs) {
    state.timeElapsed += elapsedMs;
    const dt = elapsedMs / 1000;

    // Move cells toward targets
    for (const cell of state.cells) {
      const target = state.playerTargets.get(cell.ownerId);
      if (target) {
        const dx = target.x - cell.x;
        const dy = target.y - cell.y;
        const d = Math.sqrt(dx * dx + dy * dy);

        if (d > 1) {
          const speed = (state.baseSpeed / Math.sqrt(cell.mass / 10)) * 60;
          const moveX = (dx / d) * speed * dt;
          const moveY = (dy / d) * speed * dt;
          cell.x += moveX;
          cell.y += moveY;
        }
      }

      // Apply velocity (from splits)
      if (Math.abs(cell.vx) > 0.1 || Math.abs(cell.vy) > 0.1) {
        cell.x += cell.vx * dt * 60;
        cell.y += cell.vy * dt * 60;
        cell.vx *= 0.9;
        cell.vy *= 0.9;
      }

      // Clamp to world bounds
      const r = radiusFromMass(cell.mass);
      cell.x = clamp(cell.x, r, state.worldSize - r);
      cell.y = clamp(cell.y, r, state.worldSize - r);
    }

    // Move ejected mass
    for (const ej of state.ejected) {
      ej.x += ej.vx * dt * 60;
      ej.y += ej.vy * dt * 60;
      ej.vx *= 0.88;
      ej.vy *= 0.88;
      ej.x = clamp(ej.x, 0, state.worldSize);
      ej.y = clamp(ej.y, 0, state.worldSize);
    }

    // Mass decay
    for (const cell of state.cells) {
      if (cell.mass > MASS_DECAY_THRESHOLD) {
        cell.mass -= cell.mass * MASS_DECAY_RATE;
      }
    }

    // Cell vs food
    const eatenFoodIds = new Set<string>();
    for (const cell of state.cells) {
      const cr = radiusFromMass(cell.mass);
      for (const food of state.food) {
        if (eatenFoodIds.has(food.id)) continue;
        const d = dist(cell.x, cell.y, food.x, food.y);
        if (d < cr - food.radius * 0.5) {
          cell.mass += FOOD_MASS;
          eatenFoodIds.add(food.id);
        }
      }
    }
    if (eatenFoodIds.size > 0) {
      state.food = state.food.filter((f) => !eatenFoodIds.has(f.id));
    }

    // Cell vs ejected mass
    const eatenEjIds = new Set<string>();
    for (const cell of state.cells) {
      const cr = radiusFromMass(cell.mass);
      for (const ej of state.ejected) {
        if (eatenEjIds.has(ej.id)) continue;
        if (Math.abs(ej.vx) > 1 || Math.abs(ej.vy) > 1) continue;
        const d = dist(cell.x, cell.y, ej.x, ej.y);
        if (d < cr) {
          cell.mass += ej.mass;
          eatenEjIds.add(ej.id);
        }
      }
    }
    if (eatenEjIds.size > 0) {
      state.ejected = state.ejected.filter((e) => !eatenEjIds.has(e.id));
    }

    // Cell vs cell (PvP eating)
    const eatenCellIds = new Set<string>();
    for (let i = 0; i < state.cells.length; i++) {
      const a = state.cells[i];
      if (eatenCellIds.has(a.id)) continue;
      for (let j = i + 1; j < state.cells.length; j++) {
        const b = state.cells[j];
        if (eatenCellIds.has(b.id)) continue;
        if (a.ownerId === b.ownerId) continue;

        const d = dist(a.x, a.y, b.x, b.y);
        const aR = radiusFromMass(a.mass);
        const bR = radiusFromMass(b.mass);

        if (a.mass > b.mass * EAT_RATIO && d < aR - bR * 0.4) {
          a.mass += b.mass;
          eatenCellIds.add(b.id);
        } else if (b.mass > a.mass * EAT_RATIO && d < bR - aR * 0.4) {
          b.mass += a.mass;
          eatenCellIds.add(a.id);
        }
      }
    }

    // Merge own cells
    for (let i = 0; i < state.cells.length; i++) {
      const a = state.cells[i];
      if (eatenCellIds.has(a.id)) continue;
      for (let j = i + 1; j < state.cells.length; j++) {
        const b = state.cells[j];
        if (eatenCellIds.has(b.id)) continue;
        if (a.ownerId !== b.ownerId) continue;

        const ageA = state.timeElapsed - a.splitTime;
        const ageB = state.timeElapsed - b.splitTime;
        if (ageA < MERGE_COOLDOWN_MS || ageB < MERGE_COOLDOWN_MS) continue;

        const d = dist(a.x, a.y, b.x, b.y);
        const aR = radiusFromMass(a.mass);
        const bR = radiusFromMass(b.mass);

        if (d < Math.max(aR, bR)) {
          if (a.mass >= b.mass) {
            a.mass += b.mass;
            eatenCellIds.add(b.id);
          } else {
            b.mass += a.mass;
            eatenCellIds.add(a.id);
          }
        }
      }
    }

    if (eatenCellIds.size > 0) {
      state.cells = state.cells.filter((c) => !eatenCellIds.has(c.id));
    }

    // Respawn food
    while (state.food.length < state.foodCount) {
      state.food.push(spawnFood(state));
    }

    // Respawn dead players
    const alivePlayers = new Set(state.cells.map((c) => c.ownerId));
    for (const [playerId] of state.playerTargets) {
      if (!alivePlayers.has(playerId)) {
        state.cells.push(spawnPlayerCell(state, playerId));
      }
    }
  },

  getScore(state, playerId) {
    let total = 0;
    for (const cell of state.cells) {
      if (cell.ownerId === playerId) total += cell.mass;
    }
    return Math.round(total);
  },

  getClientState(state, playerNames) {
    const names = playerNames || new Map<string, string>();
    const playerMasses = new Map<string, number>();
    for (const cell of state.cells) {
      playerMasses.set(
        cell.ownerId,
        (playerMasses.get(cell.ownerId) || 0) + cell.mass
      );
    }

    const leaderboard = [...playerMasses.entries()]
      .map(([id, mass]) => ({
        id,
        name: names.get(id) || "",
        mass: Math.round(mass),
      }))
      .sort((a, b) => b.mass - a.mass)
      .slice(0, 10);

    return {
      cells: state.cells.map((c) => ({
        id: c.id,
        ownerId: c.ownerId,
        x: Math.round(c.x * 10) / 10,
        y: Math.round(c.y * 10) / 10,
        mass: Math.round(c.mass),
        color: c.color,
      })),
      food: state.food.map((f) => ({
        id: f.id,
        x: Math.round(f.x),
        y: Math.round(f.y),
        color: f.color,
      })),
      ejected: state.ejected.map((e) => ({
        id: e.id,
        x: Math.round(e.x * 10) / 10,
        y: Math.round(e.y * 10) / 10,
        mass: Math.round(e.mass),
        color: e.color,
      })),
      leaderboard,
      timeElapsed: state.timeElapsed,
      duration: state.duration,
      worldSize: state.worldSize,
    };
  },
};
