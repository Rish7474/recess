"use client";

import { useContext } from "react";
import { SocketContext, type SocketContextValue } from "@/components/SocketProvider";

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}
