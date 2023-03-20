import Joi from 'joi';
import IAuthValidator from './interfaces/auth.validator.interface';

class AuthValidator implements IAuthValidator {
  private tokenValidator = Joi.string().label('token').required();
  constructor() {}
  validationToken = async (token: string) => {
    await this.tokenValidator.validateAsync(token);
    return;
  };
}

export default AuthValidator;
