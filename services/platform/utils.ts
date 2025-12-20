// Shared platform utilities. Keep dependency-free.

export const withTimeout = <T>(promise: Promise<T>, ms: number = 10000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out. Check your connection.')), ms)
    ),
  ]);
};

export const stripUndefined = <T extends Record<string, any>>(obj: T): T => {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
  return Object.fromEntries(entries) as T;
};
