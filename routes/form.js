var express = require('express');
var router = express.Router();
const { connectToDB, ObjectId } = require('../utils/db');

const nodemailer = require('nodemailer');

// Configure Nodemailer
let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'isblmmail@gmail.com',
        pass: 'iSBLMmail123'
    }
});

router.post('/declaration/submit', async (req, res, next) => {
    const db = await connectToDB();
    try {
        if (req.body.studentID && ObjectId.isValid(req.body.studentID)) {
            req.body.studentID = new ObjectId(req.body.studentID);
        } else {
            return res.status(400).json({ error: 'Invalid studentID' });
        }
        req.body.type = 'Declaration Form';
        req.body.approval = { supervisor: false, head: false };
        req.body.status = 'pending';
        const result = await db.collection('form').insertOne(req.body);

        // Find the student's supervisor
        const student = await db.collection('users').findOne({ _id: new ObjectId(req.body.studentID) });
        const supervisor = await db.collection('users').findOne({ _id: new ObjectId(student.supervisor) });

        console.log(supervisor.email);
        // Send an email to the supervisor
        let mailOptions = {
            from: 'isblmmail@gmail.com',
            to: 'fungtroy63@gmail.com',
            subject: 'New Declaration Form Submitted',
            text: 'A new declaration form has been submitted. Please review it.'
        };

        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });

        res.json(result);
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});

//for getting the forms from supervisor
router.put('/all', async (req, res, next) => {
    const db = await connectToDB();
    try {
        req.body.ids = req.body.ids.map(id => new ObjectId(id));
        const forms = await db.collection('form').find({
            studentID: { $in: req.body.ids },
            status: { $ne: 'approved' }
        }).toArray();
        res.json(forms);
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});

router.get('/:id', async (req, res) => {
    const formid = req.params.id;
    let form = {};
    const db = await connectToDB();
    try {
        form = await db.collection('form')
            .findOne({ _id: new ObjectId(formid) });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
    res.json(form);
});

router.put('/:formid/approval/:uid', async (req, res, next) => {
    const db = await connectToDB();
    try {
        const formid = req.params.formid;
        const uid = req.params.uid;

        // Find the form with the given formid
        const form = await db.collection('form').findOne({ _id: new ObjectId(formid) });

        const student = await db.collection('users').findOne({ _id: new ObjectId(form.studentID) });

        // Check if the supervisor of the user matches the uid
        if (student.supervisor.toString() !== uid) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const supervisor = {approval : req.body.approval, reason: req.body.reason};

        const updatedForm = await db.collection('form').updateOne(
            { _id: new ObjectId(formid) },
            { $set: { "approval.supervisor": supervisor } }
        );

        // If everything is fine, return the updated form
        res.json(updatedForm);
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});
module.exports = router;