import 'dotenv/config';
import { MongoClient, ServerApiVersion } from 'mongodb';

const mongoDBUri = process.env.MONGODBURI;
if (!mongoDBUri) {
  throw new Error('MONGODBURI not found in env');
}
const mongoClient = new MongoClient(mongoDBUri, {
  serverApi: ServerApiVersion.v1,
});

export default mongoClient;
