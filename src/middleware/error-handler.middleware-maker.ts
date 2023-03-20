import ErrorHandlerMiddleware from './error-handler.middleware';
import IErrorHandlerMiddleware from './interfaces/error-handler.middleware.interface';

const errorHandlerMiddleware: IErrorHandlerMiddleware =
  new ErrorHandlerMiddleware();

export default errorHandlerMiddleware;
