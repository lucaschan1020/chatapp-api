import { FriendDto, UserDto } from '../../../infrastructure/database/schema';

interface IUserRepository {
  findOne(
    filter: Partial<Omit<UserDto, 'friends' | 'joinedGroupPrivateChannels'>>
  ): Promise<UserDto | null>;

  findMany(ids: string[]): Promise<Record<string, UserDto>>;

  findParticipants(
    privateChannelIds: string[]
  ): Promise<Record<string, UserDto>>;

  count(
    filter: Partial<Omit<UserDto, 'friends' | 'joinedGroupPrivateChannels'>>,
    limit: number
  ): Promise<number>;

  countMany(ids: string[]): Promise<number>;

  insert(newRecord: Omit<UserDto, 'id'>): Promise<UserDto>;

  updateFriend(
    userId: string,
    friendId: string,
    update: Partial<Omit<FriendDto, 'friendId'>>
  ): Promise<FriendDto>;

  insertGroupPrivateChannel(
    ids: string[],
    privateChannelId: string
  ): Promise<number>;
}

export default IUserRepository;
