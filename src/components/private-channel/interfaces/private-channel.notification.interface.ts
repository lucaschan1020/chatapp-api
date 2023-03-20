import { PrivateChannelResponse } from './private-channel.service.interface';

interface IPrivateChannelNotification {
  notifyNewPrivateChannel(
    receivers: string[],
    payload: PrivateChannelResponse
  ): void;

  subscribe(subscriberIds: string[], privateChannelId: string): void;
}

export default IPrivateChannelNotification;
