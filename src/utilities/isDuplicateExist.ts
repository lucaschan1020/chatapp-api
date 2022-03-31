const checkIfDuplicateExists = (arr: any[]) => {
  return new Set(arr).size !== arr.length;
};

export default checkIfDuplicateExists;
