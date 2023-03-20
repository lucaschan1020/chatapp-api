import * as mongoDB from 'mongodb';
import { UserModel, PrivateChannelModel, ChatBucket } from './schema';
import { MONGODB_NAME, MONGODB_URI } from '../../config/env-keys';

export const collections: {
  users?: mongoDB.Collection<UserModel>;
  privateChannels?: mongoDB.Collection<PrivateChannelModel>;
  chatBuckets?: mongoDB.Collection<ChatBucket>;
} = {};

export async function connectToDatabase() {
  const mongoDBUri = MONGODB_URI;
  const mongoDBName = MONGODB_NAME;
  const usersCollectionName = 'users';
  const privateChannelsCollectionName = 'privateChannels';
  const chatBucketsCollectionName = 'chatBuckets';
  if (!mongoDBUri) {
    throw new Error('MONGODB_URI not found in env');
  }
  if (!mongoDBName) {
    throw new Error('MONGODB_NAME not found in env');
  }

  const client = new mongoDB.MongoClient(mongoDBUri);
  await client.connect();
  const db = client.db(mongoDBName);
  const usersCollection = db.collection<UserModel>(usersCollectionName);
  const privateChannelsCollection = db.collection<PrivateChannelModel>(
    privateChannelsCollectionName
  );
  const chatBucketsCollection = db.collection<ChatBucket>(
    chatBucketsCollectionName
  );
  collections.users = usersCollection;
  collections.privateChannels = privateChannelsCollection;
  collections.chatBuckets = chatBucketsCollection;
}
