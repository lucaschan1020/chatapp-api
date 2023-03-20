import PrivateChannelRepository from '../src/components/private-channel/private-channel.repository';
import UserRepository from '../src/components/user/user.repository';
import { connectToDatabase } from '../src/infrastructure/database';
import { FriendshipEnum } from '../src/infrastructure/database/schema';

process.on('uncaughtException', console.log);
process.on('unhandledRejection', console.log);

const runAddDummyUser = async () => {
  await connectToDatabase();
  const userRepository = new UserRepository();
  await userRepository.insert({
    sub: '9999',
    email: 'calvinharris@gmail.com',
    emailVerified: true,
    name: 'Calvin Harris',
    avatar: 'https://cdn-icons-png.flaticon.com/512/1436/1436722.png',
    givenName: 'Calvin',
    familyName: 'Harris',
    locale: 'en',
    username: 'Calvin Harris',
    discriminator: 9999,
    registerTime: new Date(),
    friends: {},
    joinedGroupPrivateChannels: [],
  });

  await userRepository.insert({
    sub: '9998',
    email: 'davidguetta@gmail.com',
    emailVerified: true,
    name: 'David Guetta',
    avatar: 'https://cdn-icons-png.flaticon.com/512/1436/1436722.png',
    givenName: 'David',
    familyName: 'Guetta',
    locale: 'en',
    username: 'David Guetta',
    discriminator: 9998,
    registerTime: new Date(),
    friends: {},
    joinedGroupPrivateChannels: [],
  });
  return;
};

const runAddDummyPrivateChannel = async () => {
  await connectToDatabase();
  const privateChannelRepository = new PrivateChannelRepository();

  await privateChannelRepository.insert({
    privateChannelName: 'Its the ship',
    dateCreated: new Date(),
    isGroup: true,
  });
  await privateChannelRepository.insert({
    privateChannelName: 'Tomorrowland',
    dateCreated: new Date(),
    isGroup: true,
  });
};

const getParticipants = async () => {
  await connectToDatabase();
  const userRepository = new UserRepository();
  const users = await userRepository.findParticipants([
    '640dbd1110440e93e8b618cf',
    '640dbd1110440e93e8b618d0',
  ]);
  console.log('done');
};

const runUpdateDummyUser = async () => {
  await connectToDatabase();
  const userRepository = new UserRepository();
  await userRepository.updateFriend(
    '6409bd025143bfb39d525503',
    '6409bd025143bfb39d525504',
    {
      friendshipStatus: FriendshipEnum.PENDING,
    }
  );

  await userRepository.updateFriend(
    '6409bd025143bfb39d525504',
    '6409bd025143bfb39d525503',
    {
      friendshipStatus: FriendshipEnum.PENDING,
    }
  );
  return;
};

getParticipants().then(() => process.exit(0));
