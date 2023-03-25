import { UserResponse } from '../components/auth/interfaces/auth.service.interface';
import {
  ChatBucketResponse,
  ChatMessageResponse,
} from '../components/chat/interfaces/chat.service.interface';
import { FriendResponse } from '../components/friend/interfaces/friend.service.interface';
import {
  ParticipantResponse,
  PrivateChannelResponse,
} from '../components/private-channel/interfaces/private-channel.service.interface';
import {
  ChatBucketDto,
  ChatMessageDto,
  FriendDto,
  PrivateChannelDto,
  UserDto,
} from '../infrastructure/database/schema';
import { objectMap } from './object-utility';

const transformUserResponse = (model: UserDto): UserResponse => {
  return {
    id: model.id,
    sub: model.sub,
    email: model.email,
    emailVerified: model.emailVerified,
    name: model.name,
    avatar: model.avatar,
    givenName: model.givenName,
    familyName: model.familyName,
    locale: model.locale,
    username: model.username,
    discriminator: model.discriminator,
  };
};

const transformFriendResponse = (
  userFriendship: FriendDto | undefined,
  friendInfo: UserDto
): FriendResponse => {
  return {
    friendId: friendInfo.id,
    friendshipStatus:
      userFriendship?.friendshipStatus !== undefined
        ? userFriendship.friendshipStatus
        : null,
    privateChannelId: userFriendship?.privateChannelId,
    avatar: friendInfo.avatar,
    username: friendInfo.username,
    discriminator: friendInfo.discriminator,
  };
};

const transformParticipantResponse = (
  participant: UserDto | ParticipantResponse
): ParticipantResponse => {
  return {
    id: participant.id,
    avatar: participant.avatar,
    username: participant.username,
    discriminator: participant.discriminator,
  };
};

const isUserDto = (user: UserDto | ParticipantResponse): user is UserDto => {
  return (user as UserDto).email !== undefined;
};

const transformPrivateChannelResponse = (
  privateChannel: PrivateChannelDto,
  participants: Record<string, UserDto | ParticipantResponse>
): PrivateChannelResponse => {
  if (Object.keys(participants).length === 0) {
    return {
      id: privateChannel.id,
      participants: {},
      privateChannelName: privateChannel.privateChannelName,
      dateCreated: privateChannel.dateCreated,
      isGroup: privateChannel.isGroup,
    };
  }

  if (isUserDto(Object.values(participants)[0])) {
    return {
      id: privateChannel.id,
      participants: objectMap(participants, (participant) =>
        transformParticipantResponse(participant)
      ),
      privateChannelName: privateChannel.privateChannelName,
      dateCreated: privateChannel.dateCreated,
      isGroup: privateChannel.isGroup,
    };
  }

  return {
    id: privateChannel.id,
    participants,
    privateChannelName: privateChannel.privateChannelName,
    dateCreated: privateChannel.dateCreated,
    isGroup: privateChannel.isGroup,
  };
};

const transformChatMessageResponse = (
  chatMessage: ChatMessageDto
): ChatMessageResponse => {
  return {
    id: chatMessage.id,
    timestamp: chatMessage.timestamp,
    senderId: chatMessage.senderId,
    content: chatMessage.content,
    lastModified: chatMessage.lastModified,
  };
};

const transformChatBucketResponse = (
  chatBucket: ChatBucketDto
): ChatBucketResponse => {
  return {
    channelId: chatBucket.channelId,
    chatMessages: chatBucket.chatMessages.map((chatMessage) =>
      transformChatMessageResponse(chatMessage)
    ),
    bucketId: chatBucket.bucketId,
  };
};

export {
  transformUserResponse,
  transformFriendResponse,
  transformParticipantResponse,
  transformPrivateChannelResponse,
  transformChatMessageResponse,
  transformChatBucketResponse,
};
