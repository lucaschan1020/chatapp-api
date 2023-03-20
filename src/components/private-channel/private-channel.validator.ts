import Joi from 'joi';
import { joiIsValidObjectId } from '../../utilities/common';
import IPrivateChannelValidator from './interfaces/private-channel.validator.interface';

class PrivateChannelValidator implements IPrivateChannelValidator {
  private privateChannelIdValidator = Joi.string()
    .label('privateChannelId')
    .custom(joiIsValidObjectId)
    .required();

  private privateChannelInfoValidator = Joi.object({
    participants: Joi.array()
      .items(Joi.string().custom(joiIsValidObjectId))
      .unique()
      .min(1)
      .max(9)
      .required(),
    privateChannelName: Joi.string().empty(''),
  });

  constructor() {}

  validatePrivateChannelId = async (privateChannelId: string) => {
    await this.privateChannelIdValidator.validateAsync(privateChannelId);
    return;
  };

  validatePrivateChannelInfo = async (privateChannelInfo: {
    participants: string[];
    privateChannelName: string;
  }) => {
    await this.privateChannelInfoValidator.validateAsync(privateChannelInfo);
    return;
  };
}

export default PrivateChannelValidator;
