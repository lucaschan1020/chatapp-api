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

const objectToArray = <T>(obj: Record<string, T>): T[] => {
  return Object.values(obj);
};

export { arrayToObject, objectToArray };
