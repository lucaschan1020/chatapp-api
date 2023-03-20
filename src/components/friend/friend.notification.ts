import { io } from '../../infrastructure/socket-io';
import IFriendNotification from './interfaces/friend.notification.interface';
import { FriendResponse } from './interfaces/friend.service.interface';

class FriendNotification implements IFriendNotification {
  constructor() {}

  notifyFriendStatus = async (receiver: string, payload: FriendResponse) => {
    io.to(`user:${receiver}`).emit('updateFriendshipStatus', payload);
  };
}

export default FriendNotification;
