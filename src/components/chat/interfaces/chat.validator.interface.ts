interface IChatValidator {
  validateChatBucketInfo(chatBucketInfo: {
    channelId: string;
    bucketId: number;
  }): Promise<void>;
  validateChannelId(channelId: string): Promise<void>;
  validateChatContent(content: string): Promise<void>;
}

export default IChatValidator;
