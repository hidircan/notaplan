export const logger = {
  info: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== "test") {
      console.info("[notaplan]", ...args);
    }
  },
  warn: (...args: unknown[]) => {
    console.warn("[notaplan]", ...args);
  },
  error: (...args: unknown[]) => {
    console.error("[notaplan]", ...args);
  },
};
