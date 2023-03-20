import express from 'express';

enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
}

class AppError extends Error {
  constructor(
    public errorType: ErrorType,
    public message: string,
    public errorInfo: any = undefined,
    public debugInfo: any = undefined,
    public isTrusted: boolean = true
  ) {
    super(message);
  }
}

interface IErrorHandlerMiddleware {
  handleError(
    error: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ): void;
}

export { ErrorType, AppError };
export default IErrorHandlerMiddleware;
