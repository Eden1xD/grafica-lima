export type ActionState = {
  status: "idle" | "ok" | "error";
  message?: string;
  data?: Record<string, unknown>;
};

export const IDLE: ActionState = { status: "idle" };