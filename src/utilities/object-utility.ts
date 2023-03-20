import { ObjectId } from 'mongodb';

const arrayToObject = <
  T extends Record<K, string | ObjectId>,
  K extends keyof T
>(
  array: T[],
  key: K
): Record<string, T> => {
  return array.reduce<Record<string, T>>(
    (accumulator, currentValue) =>
      Object.assign(accumulator, {
        [currentValue[key].toString()]: currentValue,
      }),
    {}
  );
};

const objectMap = <T, U>(
  object: Record<string, T>,
  callbackFunction: (value: T, key: string, index: number) => U
) =>
  Object.fromEntries(
    Object.entries(object).map(([k, v], i) => [k, callbackFunction(v, k, i)])
  ) as Record<string, U>;

const objectFilter = <T>(
  object: Record<string, T>,
  callbackFunction: (value: T, key: string, index: number) => boolean
) =>
  Object.fromEntries(
    Object.entries(object).filter(([k, v], i) => callbackFunction(v, k, i))
  ) as Record<string, T>;

export { arrayToObject, objectMap, objectFilter };
