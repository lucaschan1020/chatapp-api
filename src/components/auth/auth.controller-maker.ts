import AuthController from './auth.controller';
import authService from './auth.service-maker';
import IAuthController from './interfaces/auth.controller.interface';

const authController: IAuthController = new AuthController(authService);

export default authController;
