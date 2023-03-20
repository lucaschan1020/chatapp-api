import Joi from 'joi';
import { joiIsValidObjectId } from '../../utilities/common';
import IChatValidator from './interfaces/chat.validator.interface';

class ChatValidator implements IChatValidator {
  private chatBucketInfoValidator = Joi.object({
    channelId: Joi.string().custom(joiIsValidObjectId).required(),
    bucketId: Joi.number().min(0).required(),
  });
  private channelIdValidator = Joi.string()
    .label('channelId')
    .custom(joiIsValidObjectId)
    .required();
  private chatContentValidator = Joi.string().label('content').required();

  constructor() {}
  validateChatBucketInfo = async (chatBucketInfo: {
    channelId: string;
    bucketId: number;
  }) => {
    await this.chatBucketInfoValidator.validateAsync(chatBucketInfo);
    return;
  };

  validateChannelId = async (channelId: string) => {
    await this.channelIdValidator.validateAsync(channelId);
    return;
  };

  validateChatContent = async (content: string) => {
    await this.chatContentValidator.validateAsync(content);
    return;
  };
}

export default ChatValidator;
