var express = require('express');
var router = express.Router();
const { connectToDB, ObjectId } = require('../utils/db');


router.get('/',async function (req, res, next) {
    const db = await connectToDB();
    try {
        const template = await db.collection('moduleTemp').find().toArray();

        return res.json(template);
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});


module.exports = router;