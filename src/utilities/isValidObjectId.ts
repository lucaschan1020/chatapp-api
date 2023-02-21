import { ObjectId } from 'mongodb';

const isValidObjectId = (id: string) => {
  return ObjectId.isValid(id) && new ObjectId(id).toString() === id;
};

export default isValidObjectId;
