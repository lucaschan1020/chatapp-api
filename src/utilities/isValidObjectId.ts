import { ObjectId } from 'mongodb';

const isValidObjectId = (id: string) => {
  if (ObjectId.isValid(id) && new ObjectId(id).toString() === id) {
    return true;
  }
  return false;
};

export default isValidObjectId;
