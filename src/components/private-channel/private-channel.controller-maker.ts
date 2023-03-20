import IPrivateChannelController from './interfaces/private-channel.controller.interface';
import PrivateChannelController from './private-channel.controller';
import privateChannelService from './private-channel.service-maker';

const privateChannelController: IPrivateChannelController =
  new PrivateChannelController(privateChannelService);

export default privateChannelController;
