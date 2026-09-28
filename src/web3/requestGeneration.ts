/** Invalidates late async responses whenever the active data context changes. */
export class RequestGeneration {
  private value = 0;

  begin() { return ++this.value; }
  isCurrent(generation: number) { return generation === this.value; }
  invalidate() { ++this.value; }
}
