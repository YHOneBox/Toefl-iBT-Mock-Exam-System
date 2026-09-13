export class NeedMoreItems extends Error {
  readonly kind: string;

  constructor(kind: string) {
    super(`Need more unused ${kind} items`);
    this.name = "NeedMoreItems";
    this.kind = kind;
  }
}

export function isNeedMoreItems(err: unknown): err is NeedMoreItems {
  return err instanceof NeedMoreItems;
}
