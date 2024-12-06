var express = require('express');
var router = express.Router();
const { connectToDB, ObjectId } = require('../utils/db');
const { sendEmail } = require('../utils/emailServices.js');

router.post('/declaration/submit', async (req, res, next) => {
    const db = await connectToDB();
    try {
        if (req.body.studentID && ObjectId.isValid(req.body.studentID)) {
            req.body.studentID = new ObjectId(req.body.studentID);
        } else {
            return res.status(400).json({ error: 'Invalid studentID' });
        }
        req.body.type = 'Declaration Form';
        req.body.approval = { supervisor: false, head: false, adm1: false, adm2: false };
        req.body.status = 'pending';
        const result = await db.collection('form').insertOne(req.body);

        // Find the student's supervisor
        const student = await db.collection('users').findOne({ _id: new ObjectId(req.body.studentID) });
        const supervisor = await db.collection('users').findOne({ _id: new ObjectId(student.supervisor) });

        console.log(supervisor.email);
        // Send an email to the supervisor


        res.json(result);
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});

router.put('/all', async (req, res, next) => {
    const db = await connectToDB();
    try {
        req.body.ids = req.body.ids.map(id => new ObjectId(id));
        const role = req.body.role;
        if (role == 'supervisor') {
            const forms = await db.collection('form').find({
                studentID: { $in: req.body.ids },
            }).toArray();
            res.json(forms);
        } else if (role == 'head') {
            const forms = await db.collection('form').find({
                'approval.supervisor.approval': { $exists: true },
                'approval.supervisor.approval': "approved"
            }).toArray();
            console.log(forms);
            res.json(forms);
        } else if (role == 'admin') {
            const forms = await db.collection('form').find({
                'approval.supervisor.approval': 'approved',
                'approval.head.approval': 'approved'
            }).toArray();
            res.json(forms);
        }
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
        if (student.supervisor.toString() == uid) {
            const supervisor = { approval: req.body.approval, reason: req.body.reason };

            const updateFields = { "approval.supervisor": supervisor };
            if (req.body.approval === 'disapproved') {
                updateFields.status = 'disapproved';
            }

            await db.collection('form').updateOne(
                { _id: new ObjectId(formid) },
                { $set: updateFields }
            );

            // Notify the head
            const head = await db.collection('users').findOne({ isHead: true });
            await sendEmail("21222843@life.hkbu.edu.hk", 'Form Approval Needed', 'A form has been approved by the supervisor and needs your approval.');
        } else {
            const user = await db.collection('users').findOne({ _id: new ObjectId(uid) });
            if (user.isHead) {
                if (form.approval.supervisor.approval === 'approved') {
                    const head = { approval: req.body.approval, reason: req.body.reason };

                    const updateFields = { "approval.head": head };
                    if (req.body.approval === 'disapproved') {
                        updateFields.status = 'disapproved';
                    }

                    await db.collection('form').updateOne(
                        { _id: new ObjectId(formid) },
                        { $set: updateFields }
                    );

                    // Notify the admin
                    const admin = await db.collection('users').findOne({ isAdmin: true });
                    await sendEmail("21222843@life.hkbu.edu.hk", 'Form Approval Needed', 'A form has been approved by the head and needs your approval.');
                }
            } if (user.isAdmin) {
                const admin = { approval: req.body.approval, reason: req.body.reason };

                // Fetch the current form to check adm1.approval
                const form = await db.collection('form').findOne({ _id: new ObjectId(formid) });

                if (form.approval.adm1.approval === 'approved') {
                    const updateFields = { "approval.adm2": admin, "status": "approved" };
                    if (req.body.approval === 'disapproved') {
                        updateFields.status = 'disapproved';
                    }

                    await db.collection('form').updateOne(
                        { _id: new ObjectId(formid) },
                        { $set: updateFields }
                    );
                } else {
                    const updateFields = { "approval.adm1": admin };
                    if (req.body.approval === 'disapproved') {
                        updateFields.status = 'disapproved';
                    }

                    await db.collection('form').updateOne(
                        { _id: new ObjectId(formid) },
                        { $set: updateFields }
                    );
                }
            }
        }

        // If everything is fine, return the updated form
        const updatedForm = await db.collection('form').findOne({ _id: new ObjectId(formid) });
        // Send email notifications
        if (req.body.approval === 'approved') {
            const approver = await db.collection('users').findOne({ _id: new ObjectId(uid) });
            const approverName = approver.name || 'Unknown';
            const approverRole = approver.role || 'Unknown role';

            await sendEmail("21222843@life.hkbu.edu.hk", 'Form Status Update', `The form has been ${req.body.approval} by ${approverName} (${approverRole}).`);
        } else {
            const approver = await db.collection('users').findOne({ _id: new ObjectId(uid) });
            const approverName = approver.name || 'Unknown';
            const approverRole = approver.role || 'Unknown role';

            await sendEmail("21222843@life.hkbu.edu.hk", 'Form Status Update', `The form has been disapproved by ${approverName} (${approverRole}). Reason: ${req.body.reason}`);
            await sendEmail("21222843@life.hkbu.edu.hk", 'Form Status Update', `The form has been disapproved by ${approverName} (${approverRole}). Reason: ${req.body.reason}`);
        }


        if (form.status === 'approved') {
            await sendEmail("21222843@life.hkbu.edu.hk", 'Form Status Update', `The form has been approved by all approvers.`);
            await sendEmail("21222843@life.hkbu.edu.hk", 'Form Status Update', `The form has been approved by all approvers.`);
        }

        res.json(updatedForm);
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});
module.exports = router;