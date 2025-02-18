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

router.get('/:id',async function (req, res, next) {
    const db = await connectToDB();
    try{
        const template = await db.collection('moduleTemp').findOne({ _id: new ObjectId(req.params.id) });
        return res.json(template);
    }
    catch(err){
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});

router.put('/:id/topics', async (req, res) => {
    const db = await connectToDB();
    try {
        const topic = req.body.topic;
        const module = await db.collection('moduleTemp').findOne({ _id: new ObjectId(req.params.id) });
        const index = module.topics ? module.topics.length : 0;
        await db.collection('moduleTemp').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $push: { topics: { id: new ObjectId(), topic: topic, index: index } } }
        );
        res.status(200).json({ topic });
    } catch (error) {
        res.status(500).json({ message: 'Error updating topics', error });
    }
});
router.patch('/:id/topics/:topicId', async (req, res) => {
    const db = await connectToDB();
    try {
        const { topic } = req.body;
        const { id, topicId } = req.params;
        await db.collection('moduleTemp').updateOne(
            { _id: new ObjectId(id), 'topics.id': new ObjectId(topicId) },
            { $set: { 'topics.$.topic': topic } }
        );
        res.status(200).json({ message: 'Topic updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating topic', error });
    }
});
module.exports = router;