import { Filter, ObjectId, UpdateFilter, WithId } from 'mongodb';
import { collections } from '../../infrastructure/database';
import {
  FriendDto,
  FriendModel,
  UserDto,
  UserModel,
} from '../../infrastructure/database/schema';
import {
  AppError,
  ErrorType,
} from '../../middleware/interfaces/error-handler.middleware.interface';
import { arrayToObject } from '../../utilities/object-utility';
import { PartialBy } from '../../utilities/utility-types';
import IUserRepository from './interfaces/user.repository.interface';

class UserRepository implements IUserRepository {
  constructor() {}
  findOne = async (
    filter: Partial<Omit<UserDto, 'friends' | 'joinedGroupPrivateChannels'>>
  ) => {
    const mongoFilter: Filter<UserModel> = {
      _id: filter.id ? new ObjectId(filter.id) : undefined,
      sub: filter.sub,
      email: filter.email,
      emailVerified: filter.emailVerified,
      name: filter.name,
      avatar: filter.avatar,
      givenName: filter.givenName,
      familyName: filter.familyName,
      locale: filter.locale,
      username: filter.username,
      discriminator: filter.discriminator,
      registerTime: filter.registerTime,
    };

    const user = await collections.users!.findOne(mongoFilter, {
      ignoreUndefined: true,
    });
    if (!user) {
      return null;
    }
    return this.transformUserDto(user);
  };

  findMany = async (ids: string[]) => {
    const mongoFilter: Filter<UserModel> = {
      _id: { $in: ids.map((id) => new ObjectId(id)) },
    };

    const users = await collections.users!.find(mongoFilter).toArray();

    const usersDto = users.map((user) => this.transformUserDto(user));

    return arrayToObject(usersDto, 'id');
  };

  findParticipants = async (privateChannelIds: string[]) => {
    const mongoFilter: Filter<UserModel> = {
      joinedGroupPrivateChannels: {
        $in: privateChannelIds.map((id) => new ObjectId(id)),
      },
    };

    const users = await collections.users!.find(mongoFilter).toArray();

    const usersDto = users.map((user) => this.transformUserDto(user));

    return arrayToObject(usersDto, 'id');
  };

  count = async (
    filter: Partial<Omit<UserDto, 'friends' | 'joinedGroupPrivateChannels'>>,
    limit: number
  ) => {
    const mongoFilter: Filter<UserModel> = {
      _id: filter.id ? new ObjectId(filter.id) : undefined,
      sub: filter.sub,
      email: filter.email,
      emailVerified: filter.emailVerified,
      name: filter.name,
      avatar: filter.avatar,
      givenName: filter.givenName,
      familyName: filter.familyName,
      locale: filter.locale,
      username: filter.username,
      discriminator: filter.discriminator,
      registerTime: filter.registerTime,
    };

    const count = await collections.users!.countDocuments(mongoFilter, {
      limit,
      ignoreUndefined: true,
    });

    return count;
  };

  countMany = async (ids: string[]) => {
    const mongoFilter: Filter<UserModel> = {
      _id: { $in: ids.map((id) => new ObjectId(id)) },
    };

    const count = await collections.users!.countDocuments(mongoFilter);

    return count;
  };

  insert = async (newRecord: Omit<UserDto, 'id'>) => {
    const userModel = this.transformUserModel(newRecord);

    const result = await collections.users!.findOneAndUpdate(
      userModel,
      { $set: {} },
      { upsert: true, returnDocument: 'after' }
    );

    if (!result.ok || result.value === null) {
      throw new AppError(
        ErrorType.INTERNAL_SERVER_ERROR,
        'Something went wrong',
        undefined,
        {
          message: 'Failed to insert user',
          object: result,
        }
      );
    }

    return this.transformUserDto(result.value);
  };

  updateFriend = async (
    userId: string,
    friendId: string,
    update: Partial<Omit<FriendDto, 'friendId'>>
  ) => {
    const mongoFilter: Filter<UserModel> = {
      _id: new ObjectId(userId),
      'friends.friendId': new ObjectId(friendId),
    };

    const mongoUpdate: UpdateFilter<UserModel> = {
      $set: {
        'friends.$.friendId': new ObjectId(friendId),
        'friends.$.friendshipStatus': update.friendshipStatus,
        'friends.$.privateChannelId': update.privateChannelId
          ? new ObjectId(update.privateChannelId)
          : undefined,
        'friends.$.active': update.active,
      },
    };

    let updateResult = await collections.users!.findOneAndUpdate(
      mongoFilter,
      mongoUpdate,
      {
        returnDocument: 'after',
        ignoreUndefined: true,
      }
    );

    if (!updateResult.lastErrorObject) {
      throw new AppError(
        ErrorType.INTERNAL_SERVER_ERROR,
        'Something went wrong',
        undefined,
        {
          message: 'lastErrorObject not exist',
          object: updateResult,
        }
      );
    }

    if (!updateResult.lastErrorObject.updatedExisting) {
      const mongoInsertFilter: Filter<UserModel> = {
        _id: new ObjectId(userId),
      };

      const mongoInsert: UpdateFilter<UserModel> = {
        $addToSet: {
          friends: {
            friendId: new ObjectId(friendId),
            friendshipStatus: update.friendshipStatus,
            privateChannelId: update.privateChannelId
              ? new ObjectId(update.privateChannelId)
              : undefined,
            active: update.active,
          },
        },
      };
      updateResult = await collections.users!.findOneAndUpdate(
        mongoInsertFilter,
        mongoInsert,
        { returnDocument: 'after', ignoreUndefined: true }
      );

      if (!updateResult.lastErrorObject) {
        throw new AppError(
          ErrorType.INTERNAL_SERVER_ERROR,
          'Something went wrong',
          undefined,
          {
            message: 'lastErrorObject not exist',
            object: updateResult,
          }
        );
      }

      if (!updateResult.lastErrorObject.updatedExisting) {
        throw new AppError(
          ErrorType.INTERNAL_SERVER_ERROR,
          'Something went wrong',
          undefined,
          {
            message: 'Failed to update friendship',
            object: updateResult,
          }
        );
      }
    }

    if (!updateResult.value) {
      throw new AppError(
        ErrorType.INTERNAL_SERVER_ERROR,
        'Something went wrong',
        undefined,
        {
          message: 'Failed to update friendship',
          object: updateResult,
        }
      );
    }

    const updatedUserDto = this.transformUserDto(updateResult.value);
    const updatedFriendDto = updatedUserDto.friends[friendId];
    return updatedFriendDto;
  };

  insertGroupPrivateChannel = async (
    ids: string[],
    privateChannelId: string
  ) => {
    const mongoFilter: Filter<UserModel> = {
      _id: { $in: ids.map((id) => new ObjectId(id)) },
    };

    const mongoUpdate: UpdateFilter<UserModel> = {
      $addToSet: {
        joinedGroupPrivateChannels: new ObjectId(privateChannelId),
      },
    };

    const updateResult = await collections.users!.updateMany(
      mongoFilter,
      mongoUpdate
    );

    return updateResult.modifiedCount;
  };

  private transformUserModel = (
    user: PartialBy<UserDto, 'id'>
  ): WithId<UserModel> => {
    const userFriends: FriendModel[] = Object.values(user.friends).map(
      (friend) => {
        return {
          friendId: new ObjectId(friend.friendId),
          friendshipStatus: friend.friendshipStatus,
          privateChannelId: friend.privateChannelId
            ? new ObjectId(friend.privateChannelId)
            : undefined,
          active: friend.active,
        };
      }
    );

    return {
      _id: user.id ? new ObjectId(user.id) : new ObjectId(),
      sub: user.sub,
      email: user.email,
      emailVerified: user.emailVerified,
      name: user.name,
      avatar: user.avatar,
      givenName: user.givenName,
      familyName: user.familyName,
      locale: user.locale,
      username: user.username,
      discriminator: user.discriminator,
      registerTime: user.registerTime,
      friends: userFriends,
      joinedGroupPrivateChannels: user.joinedGroupPrivateChannels.map(
        (id) => new ObjectId(id)
      ),
    };
  };

  private transformUserDto = (user: WithId<UserModel>): UserDto => {
    const userFriends: FriendDto[] = user.friends.map((friend) => {
      return {
        friendId: friend.friendId.toString(),
        friendshipStatus: friend.friendshipStatus,
        privateChannelId: friend.privateChannelId?.toString(),
        active: friend.active,
      };
    });

    return {
      id: user._id.toString(),
      sub: user.sub,
      email: user.email,
      emailVerified: user.emailVerified,
      name: user.name,
      avatar: user.avatar,
      givenName: user.givenName,
      familyName: user.familyName,
      locale: user.locale,
      username: user.username,
      discriminator: user.discriminator,
      registerTime: user.registerTime,
      friends: arrayToObject(userFriends, 'friendId'),
      joinedGroupPrivateChannels: user.joinedGroupPrivateChannels.map((id) =>
        id.toString()
      ),
    };
  };
}

export default UserRepository;
