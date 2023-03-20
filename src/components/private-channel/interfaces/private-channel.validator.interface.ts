interface IPrivateChannelValidator {
  validatePrivateChannelId(channelId: string): Promise<void>;
  validatePrivateChannelInfo(privateChannelInfo: {
    participants: string[];
    privateChannelName: string;
  }): Promise<void>;
}

export default IPrivateChannelValidator;
