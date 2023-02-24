import * as mongoDB from 'mongodb';
import 'dotenv/config';
import { UserModel, PrivateChannel, ChatBucket } from './schema';

export const collections: {
  users?: mongoDB.Collection<UserModel>;
  privateChannels?: mongoDB.Collection<PrivateChannel>;
  chatBuckets?: mongoDB.Collection<ChatBucket>;
} = {};

export async function connectToDatabase() {
  const mongoDBUri = process.env.MONGODB_URI;
  const mongoDBName = process.env.MONGODB_NAME;
  const usersCollectionName = process.env.USERS_COLLECTION_NAME;
  const privateChannelsCollectionName =
    process.env.PRIVATECHANNELS_COLLECTION_NAME;
  const chatBucketsCollectionName = process.env.CHATBUCKETS_COLLECTION_NAME;
  if (!mongoDBUri) {
    throw new Error('MONGODB_URI not found in env');
  }
  if (!mongoDBName) {
    throw new Error('MONGODB_NAME not found in env');
  }
  if (!usersCollectionName) {
    throw new Error('USERS_COLLECTION_NAME not found in env');
  }
  if (!privateChannelsCollectionName) {
    throw new Error('PRIVATECHANNELS_COLLECTION_NAME not found in env');
  }
  if (!chatBucketsCollectionName) {
    throw new Error('CHATBUCKETS_COLLECTION_NAME not found in env');
  }

  const client = new mongoDB.MongoClient(mongoDBUri);
  await client.connect();
  const db = client.db(mongoDBName);
  const usersCollection = db.collection<UserModel>(usersCollectionName);
  const privateChannelsCollection = db.collection<PrivateChannel>(
    privateChannelsCollectionName
  );
  const chatBucketsCollection = db.collection<ChatBucket>(
    chatBucketsCollectionName
  );
  collections.users = usersCollection;
  collections.privateChannels = privateChannelsCollection;
  collections.chatBuckets = chatBucketsCollection;
}
