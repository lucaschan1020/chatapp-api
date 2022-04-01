import { collections, connectToDatabase } from '../database';
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
    const lucasModified = await collections.users!.updateOne(
      {
        email: LUCAS.EMAIL,
      },
      {
        $unset: { [`friends.${LUCAS.FRIENDID}`]: '' },
      }
    );

    const benModified = await collections.users!.updateOne(
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
  }
};

const setNullFriend = async () => {
  try {
    const lucasModified = await collections.users!.updateOne(
      {
        email: LUCAS.EMAIL,
      },
      {
        $set: { [`friends.${LUCAS.FRIENDID}.friendshipStatus`]: null },
      }
    );

    const benModified = await collections.users!.updateOne(
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
  }
};

connectToDatabase().then(() => {
  setNullFriend();
});
