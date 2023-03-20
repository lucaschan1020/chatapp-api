import FriendController from './friend.controller';
import friendService from './friend.service-maker';
import IFriendController from './interfaces/friend.controller.interface';

const friendController: IFriendController = new FriendController(friendService);

export default friendController;
