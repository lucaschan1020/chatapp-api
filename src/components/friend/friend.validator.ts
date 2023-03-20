import Joi from 'joi';
import { FriendshipEnum } from '../../infrastructure/database/schema';
import IFriendValidator from './interfaces/friend.validator.interface';

class FriendValidator implements IFriendValidator {
  private friendInfo = Joi.object({
    username: Joi.string().required(),
    discriminator: Joi.number().min(0).max(9999).required(),
  });

  private friendshipStatusValidator = Joi.string()
    .label('friendshipStatus')
    .valid(
      FriendshipEnum.FRIEND,
      FriendshipEnum.PENDING,
      FriendshipEnum.REQUESTED,
      FriendshipEnum.BLOCKED
    )
    .required();

  constructor() {}

  validateFriendInfo = async (friendInfo: {
    username: string;
    discriminator: number;
  }) => {
    await this.friendInfo.validateAsync(friendInfo);
    return;
  };

  validateFriendshipStatus = async (friendshipStatus: FriendshipEnum) => {
    await this.friendshipStatusValidator.validateAsync(friendshipStatus);
    return;
  };
}

export default FriendValidator;
