import FriendNotification from '../friend/friend.notification';
import UserRepository from '../user/user.repository';
import IPrivateChannelService from './interfaces/private-channel.service.interface';
import PrivateChannelNotification from './private-channel.notification';
import PrivateChannelRepository from './private-channel.repository';
import PrivateChannelService from './private-channel.service';
import PrivateChannelValidator from './private-channel.validator';

const privateChannelService: IPrivateChannelService = new PrivateChannelService(
  new UserRepository(),
  new PrivateChannelRepository(),
  new FriendNotification(),
  new PrivateChannelNotification(),
  new PrivateChannelValidator()
);

export default privateChannelService;
