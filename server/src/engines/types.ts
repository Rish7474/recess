export type PlayerInput =
  | { type: "move"; x: number; y: number }
  | { type: "split" }
  | { type: "eject" };

export interface BaseGameState {
  timeElapsed: number;
  duration: number;
}

export interface GameEngine<TState extends BaseGameState = BaseGameState> {
  initState(params: Record<string, unknown>, playerCount: number, duration: number): TState;
  processInput(state: TState, playerId: string, input: PlayerInput): void;
  tick(state: TState, elapsedMs: number): void;
  getScore(state: TState, playerId: string): number;
  getClientState(state: TState, playerNames?: Map<string, string>): Record<string, unknown>;
  onPlayerJoin?(state: TState, playerId: string): void;
  onPlayerLeave?(state: TState, playerId: string): void;
}
