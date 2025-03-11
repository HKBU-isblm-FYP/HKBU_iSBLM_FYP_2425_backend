var express = require('express');
var router = express.Router();

const { connectToDB, ObjectId } = require('../utils/db');
// Route to get all categories
router.get('/', async (req, res) => {
    let db;
    try {
        db = await connectToDB();
        const categories = await db.collection('categories').find({}).toArray();
        res.json({ categories: categories });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: 'Internal Server Error' });
    } finally {
        if (db) {
            // await db.client.close();
        }
    }
});

module.exports = router;