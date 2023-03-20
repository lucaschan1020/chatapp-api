import express from 'express';
import IErrorHandlerMiddleware, {
  AppError,
  ErrorType,
} from './interfaces/error-handler.middleware.interface';
import { constants as httpConstants } from 'http2';
import Joi from 'joi';

class ErrorHandlerMiddleware implements IErrorHandlerMiddleware {
  constructor() {}

  handleError = (
    error: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (!(error instanceof Error)) {
      next(error);
    }

    const appError: AppError = this.normalizeError(error);
    if (!appError.isTrusted) {
      console.error(appError.debugInfo);
      console.error(appError.stack);
      // unexpected error, crash and let auto healing restart the app
      process.exit(1);
    }

    const response = {
      message: appError.message,
      errorInfo: appError.errorInfo,
    };
    if (appError.debugInfo) {
      console.log(appError.debugInfo);
      console.log(appError.stack);
    }

    if (appError.errorType === ErrorType.VALIDATION_ERROR) {
      res.status(httpConstants.HTTP_STATUS_BAD_REQUEST).json(response);
      return next();
    }
    if (appError.errorType === ErrorType.AUTHENTICATION_ERROR) {
      res.status(httpConstants.HTTP_STATUS_UNAUTHORIZED).json(response);
      return next();
    }
    if (appError.errorType === ErrorType.AUTHORIZATION_ERROR) {
      res.status(httpConstants.HTTP_STATUS_FORBIDDEN).json(response);
      return next();
    }
    if (appError.errorType === ErrorType.NOT_FOUND_ERROR) {
      res.status(httpConstants.HTTP_STATUS_NOT_FOUND).json(response);
      return next();
    }
    if (appError.errorType === ErrorType.INTERNAL_SERVER_ERROR) {
      res
        .status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR)
        .json(response);
      return next();
    }

    // default error
    res.status(httpConstants.HTTP_STATUS_INTERNAL_SERVER_ERROR).json(response);
    return next();
  };

  private normalizeError = (error: Error): AppError => {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Joi.ValidationError) {
      const appError = new AppError(ErrorType.VALIDATION_ERROR, error.message);
      appError.stack = error.stack;
      return appError;
    }

    const appError = new AppError(
      ErrorType.INTERNAL_SERVER_ERROR,
      'Something went wrong',
      undefined,
      error.message
    );
    appError.stack = error.stack;
    return appError;
  };
}

export default ErrorHandlerMiddleware;
