export const STAGES = ["quote", "order", "artwork", "proof", "production", "completed"] as const;
export type Stage = (typeof STAGES)[number];
