var express = require('express');
var router = express.Router();
const { connectToDB, ObjectId } = require('../utils/db');
const { sendEmail } = require('../utils/emailServices.js');
const { createBlob } = require('../utils/azure-blob.js');

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
        req.body.submittedAt = new Date();
        proposal = await createBlob(req.files.proposal.name, req.files.proposal.data);
        req.body.proposal = proposal;
        studyPlan = await createBlob(req.files.studyPlan.name, req.files.studyPlan.data);
        req.body.studyPlan = studyPlan;
        
        const result = await db.collection('form').insertOne(req.body);

        // Find the student's supervisor
        const student = await db.collection('users').findOne({ _id: new ObjectId(req.body.studentID) });
        const supervisor = await db.collection('users').findOne({ _id: new ObjectId(student.supervisor) });

        const emailContent = `
            <p>Dear ${supervisor.name},</p>
            <p>A new declaration form has been submitted by your student, <strong>${student.name}</strong>.</p>
            <p>Details of the submission:</p>
            <ul>
                <li>Student ID: ${student._id}</li>
                <li>Form Type: ${req.body.type}</li>
                <li>Status: ${req.body.status}</li>
            </ul>
            <p>Please review and approve the form at your earliest convenience.</p>
            <p>Thank you.</p>
            <p>Best regards,</p>
            <p>ISBLM system</p>
        `;

        await sendEmail(
            "21222843@life.hkbu.edu.hk",
            'Form Approval Needed',
            emailContent
        );

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
            await sendEmail(
                "21222843@life.hkbu.edu.hk",
                'Form Approval Needed',
                `
                <p>Dear ${head.name},</p>
                <p>The form submitted by a student has been approved by the supervisor and now requires your approval.</p>
                <p>Form Details:</p>
                <ul>
                    <li>Form ID: ${form._id}</li>
                    <li>Student ID: ${form.studentID}</li>
                    <li>Form Type: ${form.type}</li>
                    <li>Status: ${form.status}</li>
                </ul>
                <p>Please review and approve the form at your earliest convenience.</p>
                <p>Thank you.</p>
                <p>Best regards,</p>
                <p>Your University Administration</p>
                `
            ); } else {
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
                    await sendEmail(
                        admin.email,
                        'Form Approval Needed',
                        `
                        <p>Dear ${admin.name},</p>
                        <p>The form submitted by a student has been approved by the head and now requires your approval.</p>
                        <p>Form Details:</p>
                        <ul>
                            <li>Form ID: ${form._id}</li>
                            <li>Student ID: ${form.studentID}</li>
                            <li>Form Type: ${form.type}</li>
                            <li>Status: ${form.status}</li>
                        </ul>
                        <p>Please review and approve the form at your earliest convenience.</p>
                        <p>Thank you.</p>
                        <p>Best regards,</p>
                        <p>Your University Administration</p>
                        `
                    );     }
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

            await sendEmail(
                "21222843@life.hkbu.edu.hk",
                'Form Status Update',
                `
                <p>Dear Student,</p>
                <p>Your form has been <strong>approved</strong> by ${approverName} (${approverRole}).</p>
                <p>Form Details:</p>
                <ul>
                    <li>Form ID: ${form._id}</li>
                    <li>Form Type: ${form.type}</li>
                    <li>Status: ${form.status}</li>
                </ul>
                <p>Thank you.</p>
                <p>Best regards,</p>
                <p>Your University Administration</p>
                `
            );
        } else {
            const approver = await db.collection('users').findOne({ _id: new ObjectId(uid) });
            const approverName = approver.name || 'Unknown';
            const approverRole = approver.role || 'Unknown role';

            await sendEmail(
                "21222843@life.hkbu.edu.hk",
                'Form Status Update',
                `
                <p>Dear Student,</p>
                <p>Your form has been <strong>disapproved</strong> by ${approverName} (${approverRole}).</p>
                <p>Reason: ${req.body.reason}</p>
                <p>Form Details:</p>
                <ul>
                    <li>Form ID: ${form._id}</li>
                    <li>Form Type: ${form.type}</li>
                    <li>Status: ${form.status}</li>
                </ul>
                <p>Thank you.</p>
                <p>Best regards,</p>
                <p>Your University Administration</p>
                `
            );
        }

        if (form.status === 'approved') {
            await sendEmail(
                "21222843@life.hkbu.edu.hk",
                'Form Status Update',
                `
                <p>Dear Student,</p>
                <p>Your form has been <strong>approved</strong> by all approvers.</p>
                <p>Form Details:</p>
                <ul>
                    <li>Form ID: ${form._id}</li>
                    <li>Form Type: ${form.type}</li>
                    <li>Status: ${form.status}</li>
                </ul>
                <p>Thank you.</p>
                <p>Best regards,</p>
                <p>Your University Administration</p>
                `
            );
        }
        res.json(updatedForm);
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});
module.exports = router;