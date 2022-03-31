import mongoClient from '../database';
import { User } from '../database/schema';

const LUCAS = {
  EMAIL: 'lucaschan102098@gmail.com',
  FRIENDID: '62334ff6d868e19d2b4c0a2d',
};

const BEN = {
  EMAIL: 'benleong6001@gmail.com',
  FRIENDID: '62334ffcd868e19d2b4c0a2e',
};

const deleteFriend = async () => {
  try {
    await mongoClient.connect();
    const userCollection = await mongoClient
      .db(process.env.MONGODBNAME)
      .collection<User>('users');

    const lucasModified = await userCollection.updateOne(
      {
        email: LUCAS.EMAIL,
      },
      {
        $unset: { [`friends.${LUCAS.FRIENDID}`]: '' },
      }
    );

    const benModified = await userCollection.updateOne(
      {
        email: BEN.EMAIL,
      },
      {
        $unset: { [`friends.${BEN.FRIENDID}`]: '' },
      }
    );
    console.log(`LUCAS modified ${lucasModified.modifiedCount}`);
    console.log(`BEN modified ${benModified.modifiedCount}`);
  } catch (e) {
    console.log('error!');
    console.log(e);
  } finally {
    await mongoClient.close();
  }
};

const setNullFriend = async () => {
  try {
    await mongoClient.connect();
    const userCollection = await mongoClient
      .db(process.env.MONGODBNAME)
      .collection<User>('users');

    const lucasModified = await userCollection.updateOne(
      {
        email: LUCAS.EMAIL,
      },
      {
        $set: { [`friends.${LUCAS.FRIENDID}.friendshipStatus`]: null },
      }
    );

    const benModified = await userCollection.updateOne(
      {
        email: BEN.EMAIL,
      },
      {
        $set: { [`friends.${BEN.FRIENDID}.friendshipStatus`]: null },
      }
    );
    console.log(`LUCAS modified ${lucasModified.modifiedCount}`);
    console.log(`BEN modified ${benModified.modifiedCount}`);
  } catch (e) {
    console.log('error!');
    console.log(e);
  } finally {
    await mongoClient.close();
  }
};

deleteFriend();
