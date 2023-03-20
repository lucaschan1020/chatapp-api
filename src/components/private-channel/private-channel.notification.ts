import { io } from '../../infrastructure/socket-io';
import IPrivateChannelNotification from './interfaces/private-channel.notification.interface';
import { PrivateChannelResponse } from './interfaces/private-channel.service.interface';

class PrivateChannelNotification implements IPrivateChannelNotification {
  constructor() {}
  notifyNewPrivateChannel(
    receivers: string[],
    payload: PrivateChannelResponse
  ): void {
    const receiversRoom = receivers.map((receiver) => `user:${receiver}`);

    io.to(receiversRoom).emit('newPrivateChannelChat', payload);
  }

  subscribe(subscriberIds: string[], privateChannelId: string) {
    const subscriberRoom = subscriberIds.map(
      (subscriberId) => `user:${subscriberId}`
    );

    io.in(subscriberRoom).socketsJoin(`privateChannel:${privateChannelId}`);
  }
}

export default PrivateChannelNotification;
