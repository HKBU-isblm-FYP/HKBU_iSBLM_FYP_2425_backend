var express = require('express');
var router = express.Router();
const { connectToDB, ObjectId } = require('../utils/db');

router.get('/all/:id', async function (req, res, next) {
    const studentid = req.params.id;
    let modules = [];
    const db = await connectToDB();
    try {
        modules = await db.collection('modules')
            .find({ student: new ObjectId(studentid) })
            .project({ _id: 1, moduleName: 1, student: 1, sem: 1 })
            .toArray();
        modules.sort((a, b) => a.sem.localeCompare(b.sem));
        return res.json(modules);
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
    res.json(modules);
});

router.get('/:id', async function (req, res, next) {
    const moduleid = req.params.id;
    let module = {};
    const db = await connectToDB();
    try {
        module = await db.collection('modules')
            .findOne({ _id: new ObjectId(moduleid) });
            return res.json(module);
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
    res.json(module);
});

router.post('/create/:id', async function (req, res, next) {
    const studentid = req.params.id;
    const db = await connectToDB();
    try {
        // Fetch the template
        const template = await db.collection('moduleTemp').find().toArray();

        // Insert the student ID into each module in the template and remove the _id field
        const modulesWithStudentId = template.map(module => {
            const { _id, ...moduleWithoutId } = module;
            return {
                ...moduleWithoutId,
                student: new ObjectId(studentid)
            };
        });

        // Insert the modified modules into the 'modules' collection
        const insertResult = await db.collection('modules').insertMany(modulesWithStudentId);

        // Fetch the inserted documents to sort them
        const insertedModules = await db.collection('modules').find({ student: studentid }).toArray();
        insertedModules.sort((a, b) => a.sem.localeCompare(b.sem));

        res.json(insertedModules);
    } catch (err) {
        console.log(err);
        if (!res.headersSent) {
            return res.status(500).json({ error: err.toString() });
        }
    }
});
router.put('/meetings/delete/:id', async function (req, res, next) {
    const moduleid = req.params.id;
    const db = await connectToDB();
    try {
        const result = await db.collection('modules')
            .updateOne({ _id: new ObjectId(moduleid) }, { $set: { meetings: req.body.meetings } });
            return res.json(result);
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});


router.put('/meetings/add/:id', async function (req, res, next) {
    const moduleid = req.params.id;
    const newMeeting = req.body.newMeeting; // Assuming the new meeting object is in req.body.newMeeting
    newMeeting.meetingID = new ObjectId(); // Generate a new ObjectId for meetingID
    const db = await connectToDB();
    try {
        const result = await db.collection('modules')
            .updateOne(
                { _id: new ObjectId(moduleid) },
                { $push: { meetings: newMeeting } }
            );
            return res.json(result);
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});

router.put('/meetings/update/:id', async function (req, res, next) {
    const moduleid = req.params.id;
    const updatedMeetings = req.body.meetings;
    const db = await connectToDB();
    try {
        const result = await db.collection('modules')
            .updateOne(
                { _id: new ObjectId(moduleid) },
                { $set: { meetings: updatedMeetings } }
            );
            return res.json(result);
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});
router.put('/meetings/weekly/rate/:id', async function (req, res, next) {
    const moduleid = req.params.id;
    const meetingID = req.body.meetingID;
    const ratings = req.body.ratings;
    const db = await connectToDB();
    try {
        const result = await db.collection('modules')
            .updateOne(
                { _id: new ObjectId(moduleid), "meetings.meetingID": new ObjectId(meetingID) },
                { $set: { "meetings.$.ratings": ratings } }
            );
            return res.json(result);
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});
module.exports = router;