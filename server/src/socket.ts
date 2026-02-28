import { Server, Socket } from "socket.io";
import {
  handlePlayerInput,
  handlePlayerJoin,
  handlePlayerLeave,
  isGameActive,
} from "./game/lifecycle";
import { PlayerInput } from "./engines/types";

const playerSockets = new Map<string, string>(); // socketId -> userId
const playerNames = new Map<string, string>(); // socketId -> display name
let playerCount = 0;

export function setupSocket(io: Server) {
  io.on("connection", (socket: Socket) => {
    playerCount++;
    console.log(
      `[socket] connected: ${socket.id} (${playerCount} online)`
    );
    io.emit("player_count", playerCount);

    if (isGameActive()) {
      handlePlayerJoin(socket.id);
    }

    socket.on("player_join", (data: { userId: string }) => {
      if (data?.userId) {
        playerSockets.set(socket.id, data.userId);
        console.log(
          `[socket] player_join: ${data.userId} on ${socket.id}`
        );
      }
    });

    socket.on("set_name", (name: string) => {
      if (typeof name === "string" && name.trim().length > 0) {
        const sanitized = name.trim().slice(0, 16);
        playerNames.set(socket.id, sanitized);
        console.log(`[socket] set_name: ${socket.id} -> "${sanitized}"`);
      }
    });

    socket.on("player_input", (input: PlayerInput) => {
      if (!isGameActive()) return;
      handlePlayerInput(socket.id, input);
    });

    socket.on("disconnect", () => {
      if (isGameActive()) {
        handlePlayerLeave(socket.id);
      }
      playerCount = Math.max(0, playerCount - 1);
      playerSockets.delete(socket.id);
      playerNames.delete(socket.id);
      console.log(
        `[socket] disconnected: ${socket.id} (${playerCount} online)`
      );
      io.emit("player_count", playerCount);
    });
  });
}

export function getPlayerCount(): number {
  return playerCount;
}

export function getPlayerSockets(): Map<string, string> {
  return playerSockets;
}

export function getPlayerNames(): Map<string, string> {
  return playerNames;
}
