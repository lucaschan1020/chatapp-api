import { PrivateChannelDto } from '../../../infrastructure/database/schema';

interface IPrivateChannelRepository {
  findOne(
    filter: Partial<PrivateChannelDto>
  ): Promise<PrivateChannelDto | null>;

  findAll(ids: string[]): Promise<Record<string, PrivateChannelDto>>;

  insert(newRecord: Omit<PrivateChannelDto, 'id'>): Promise<PrivateChannelDto>;
}

export default IPrivateChannelRepository;
