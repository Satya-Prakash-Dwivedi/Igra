import mongoose from 'mongoose';
mongoose.connect('mongodb://localhost:27017/igra_dev'); // Adjust DB name if needed

const assetSchema = new mongoose.Schema({}, { strict: false });
const Asset = mongoose.model('Asset', assetSchema, 'assets');

async function run() {
  const asset = await Asset.findById('69efc9622f696d689ed55b8e');
  console.log('Asset:', asset);
  process.exit(0);
}
run();
