import { UserDto } from '../../../infrastructure/database/schema';

interface ParticipantResponse {
  id: string;
  avatar: string;
  username: string;
  discriminator: number;
}

interface PrivateChannelResponse {
  id: string;
  participants: Record<string, ParticipantResponse>;
  privateChannelName: string;
  dateCreated: Date;
  isGroup: boolean;
}

interface IPrivateChannelService {
  getPrivateChannel(
    user: UserDto,
    privateChannelId: string
  ): Promise<PrivateChannelResponse>;

  getAllPrivateChannels(
    user: UserDto
  ): Promise<Record<string, PrivateChannelResponse>>;

  createPrivateChannel(
    user: UserDto,
    privateChannelInfo: { participants: string[]; privateChannelName: string }
  ): Promise<PrivateChannelResponse>;
}

export default IPrivateChannelService;
export { ParticipantResponse, PrivateChannelResponse };
