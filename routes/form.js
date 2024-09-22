var express = require('express');
var router = express.Router();
const { connectToDB, ObjectId } = require('../utils/db');

router.post('/declaration/submit', async (req, res, next) => {
    const db = await connectToDB();
    try {
        if (req.body.studentID && ObjectId.isValid(req.body.studentID)) {
            req.body.studentID = new ObjectId(req.body.studentID);
        } else {
            return res.status(400).json({ error: 'Invalid studentID' });
        }

        const result = await db.collection('form').insertOne(req.body);

        res.json(result);
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});

module.exports = router;