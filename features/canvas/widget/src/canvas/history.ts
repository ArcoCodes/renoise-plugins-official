export class History<T> {
  private past: T[] = [];
  private future: T[] = [];

  constructor(
    private current: T,
    private readonly limit = 100,
    private readonly equal: (left: T, right: T) => boolean = (left, right) =>
      JSON.stringify(left) === JSON.stringify(right),
  ) {
    this.current = structuredClone(current);
  }

  push(value: T) {
    if (this.equal(value, this.current)) {
      this.current = structuredClone(value);
      return false;
    }
    this.past.push(structuredClone(this.current));
    if (this.past.length > this.limit) this.past.shift();
    this.current = structuredClone(value);
    this.future = [];
    return true;
  }

  reset(value: T) {
    this.current = structuredClone(value);
    this.past = [];
    this.future = [];
  }

  replaceCurrent(value: T) {
    this.current = structuredClone(value);
  }

  undo(): T | null {
    const previous = this.past.pop();
    if (!previous) return null;
    this.future.push(structuredClone(this.current));
    this.current = structuredClone(previous);
    return structuredClone(previous);
  }

  redo(): T | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(structuredClone(this.current));
    this.current = structuredClone(next);
    return structuredClone(next);
  }

  rollback(direction: "undo" | "redo") {
    if (direction === "undo") {
      const original = this.future.pop();
      if (!original) return false;
      this.past.push(structuredClone(this.current));
      this.current = structuredClone(original);
      return true;
    }
    const original = this.past.pop();
    if (!original) return false;
    this.future.push(structuredClone(this.current));
    this.current = structuredClone(original);
    return true;
  }

  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
}
