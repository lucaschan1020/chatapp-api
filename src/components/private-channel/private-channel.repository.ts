import { Filter, ObjectId, WithId } from 'mongodb';
import { collections } from '../../infrastructure/database';
import {
  PrivateChannelDto,
  PrivateChannelModel,
} from '../../infrastructure/database/schema';
import {
  AppError,
  ErrorType,
} from '../../middleware/interfaces/error-handler.middleware.interface';
import { arrayToObject } from '../../utilities/object-utility';
import { PartialBy } from '../../utilities/utility-types';
import IPrivateChannelRepository from './interfaces/private-channel.repository.interface';

class PrivateChannelRepository implements IPrivateChannelRepository {
  constructor() {}

  findOne = async (filter: Partial<PrivateChannelDto>) => {
    const mongoFilter: Filter<PrivateChannelModel> = {
      _id: filter.id ? new ObjectId(filter.id) : undefined,
      privateChannelName: filter.privateChannelName,
      dateCreated: filter.dateCreated,
      isGroup: filter.isGroup,
    };

    const privateChannel = await collections.privateChannels!.findOne(
      mongoFilter,
      {
        ignoreUndefined: true,
      }
    );

    if (!privateChannel) {
      return null;
    }
    return this.transformPrivateChannelDto(privateChannel);
  };

  findAll = async (ids: string[]) => {
    const mongoFilter: Filter<PrivateChannelModel> = {
      _id: { $in: ids.map((id) => new ObjectId(id)) },
    };

    const privateChannels = await collections
      .privateChannels!.find(mongoFilter)
      .toArray();

    const privateChannelDtos = privateChannels.map((privateChannels) =>
      this.transformPrivateChannelDto(privateChannels)
    );

    return arrayToObject(privateChannelDtos, 'id');
  };

  insert = async (newRecord: Omit<PrivateChannelDto, 'id'>) => {
    const privateChannelModel = this.transformPrivateChannelModel(newRecord);

    const result = await collections.privateChannels!.findOneAndUpdate(
      privateChannelModel,
      { $set: {} },
      { upsert: true, returnDocument: 'after' }
    );

    if (!result.ok || result.value === null) {
      throw new AppError(
        ErrorType.INTERNAL_SERVER_ERROR,
        'Something went wrong',
        undefined,
        {
          message: 'Failed to insert private channel',
          object: result,
        }
      );
    }

    return this.transformPrivateChannelDto(result.value);
  };

  private transformPrivateChannelModel = (
    privateChannel: PartialBy<PrivateChannelDto, 'id'>
  ): WithId<PrivateChannelModel> => {
    return {
      _id: privateChannel.id ? new ObjectId(privateChannel.id) : new ObjectId(),
      privateChannelName: privateChannel.privateChannelName,
      dateCreated: privateChannel.dateCreated,
      isGroup: privateChannel.isGroup,
    };
  };

  private transformPrivateChannelDto = (
    privateChannel: WithId<PrivateChannelModel>
  ): PrivateChannelDto => {
    return {
      id: privateChannel._id.toString(),
      privateChannelName: privateChannel.privateChannelName,
      dateCreated: privateChannel.dateCreated,
      isGroup: privateChannel.isGroup,
    };
  };
}

export default PrivateChannelRepository;
