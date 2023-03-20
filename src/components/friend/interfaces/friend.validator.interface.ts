import { FriendshipEnum } from '../../../infrastructure/database/schema';

interface IFriendValidator {
  validateFriendInfo(friendInfo: {
    username: string;
    discriminator: number;
  }): Promise<void>;
  validateFriendshipStatus(friendshipStatus: FriendshipEnum): Promise<void>;
}

export default IFriendValidator;
