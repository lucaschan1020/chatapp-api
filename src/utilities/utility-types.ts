type PartialBy<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>> &
  Partial<Pick<T, K>>;

// replace property of a type with another type
type ChangeFields<T, R> = Omit<T, keyof R> & R;

export { PartialBy, ChangeFields };
