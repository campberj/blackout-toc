/** Minimal change notification so the UI store layer can mirror service state. */
export interface Emitter<T> {
  subscribe(fn: (value: T) => void): () => void;
  emit(value: T): void;
}

export function createEmitter<T>(): Emitter<T> {
  const fns = new Set<(value: T) => void>();
  return {
    subscribe(fn) {
      fns.add(fn);
      return () => fns.delete(fn);
    },
    emit: (value) => fns.forEach((fn) => fn(value)),
  };
}
