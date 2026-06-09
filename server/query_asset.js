import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const AssetVersion = mongoose.model('AssetVersion', new mongoose.Schema({}, { strict: false, collection: 'assetversions' }));
  const versions = await AssetVersion.find({ assetId: new mongoose.Types.ObjectId("69efc9622f696d689ed55b8e") });
  console.log("Versions:", versions);
  mongoose.connection.close();
});
