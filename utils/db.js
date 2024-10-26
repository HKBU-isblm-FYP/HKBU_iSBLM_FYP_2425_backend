const { MongoClient, ObjectId } = require('mongodb');

process.env.MONGODB_URI = 'mongodb+srv://20218168:ezotpsv1pUAqFlP4@emails.mkowmvt.mongodb.net/?retryWrites=true&w=majority';
// process.env.MONGODB_URI = 'mongodb://<username>:<password>@<endpoint>.documents.azure.com:10255/?ssl=true';

//url: mongodb+srv://20218168:ezotpsv1pUAqFlP4@emails.mkowmvt.mongodb.net/

///Conn str password: <password>
//API - key: SqBvnLw7k4c3Ogotc3UIiSLiaS0M3wJ3bV2wetb6O4nJsTHVu0Z4d2kFITIVAl2p

if (!process.env.MONGODB_URI) {
    // throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
    process.env.MONGODB_URI = 'mongodb://localhost:27017';
}

// Connect to MongoDB
async function connectToDB() {
    const client = await MongoClient.connect(process.env.MONGODB_URI);
    const db = client.db('iSBLM');
    db.client = client;
    return db;
}

module.exports = { connectToDB, ObjectId };