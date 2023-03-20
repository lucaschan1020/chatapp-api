import { FriendResponse } from './friend.service.interface';

interface IFriendNotification {
  notifyFriendStatus(receiver: string, payload: FriendResponse): void;
}

export default IFriendNotification;
