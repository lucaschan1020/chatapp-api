import { ObjectId } from 'mongodb';
import express from 'express';
import Joi from 'joi';

const isValidObjectId = (id: string) => {
  return ObjectId.isValid(id) && new ObjectId(id).toString() === id;
};

const joiIsValidObjectId: Joi.CustomValidator<string> = (
  value: string,
  helpers: Joi.CustomHelpers<any>
) => {
  if (!isValidObjectId(value)) {
    return helpers.error('string.guid');
  }
  return value;
};

const isDuplicateExists = (arr: any[]) => {
  return new Set(arr).size !== arr.length;
};

const tryCatch =
  (
    controller: (
      req: express.Request<any>,
      res: express.Response<any, any>,
      next: express.NextFunction
    ) => void
  ) =>
  async (
    req: express.Request<any>,
    res: express.Response<any, any>,
    next: express.NextFunction
  ) => {
    try {
      await controller(req, res, next);
    } catch (error) {
      next(error);
    }
  };

export { isValidObjectId, joiIsValidObjectId, isDuplicateExists, tryCatch };
