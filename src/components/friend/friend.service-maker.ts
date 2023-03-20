import PrivateChannelNotification from '../private-channel/private-channel.notification';
import PrivateChannelRepository from '../private-channel/private-channel.repository';
import UserRepository from '../user/user.repository';
import FriendNotification from './friend.notification';
import FriendService from './friend.service';
import FriendValidator from './friend.validator';
import IFriendService from './interfaces/friend.service.interface';

const friendService: IFriendService = new FriendService(
  new UserRepository(),
  new PrivateChannelRepository(),
  new FriendNotification(),
  new PrivateChannelNotification(),
  new FriendValidator()
);

export default friendService;
