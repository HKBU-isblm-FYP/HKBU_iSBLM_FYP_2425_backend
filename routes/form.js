var express = require('express');
var router = express.Router();
const { connectToDB, ObjectId } = require('../utils/db');
const { sendEmail } = require('../utils/emailServices.js');
const { createBlob } = require('../utils/azure-blob');

router.post('/declaration/submit/:id', async (req, res, next) => {
    const db = await connectToDB();
    try {

        req.body.type = 'Declaration Form';

        req.body.approval = { supervisor: false, head: false, director: false, adm1: false, adm2: false };
        req.body.status = 'pending';
        req.body.submittedAt = new Date();
        proposal = await createBlob(req.files.proposal.name, req.files.proposal.data);
        req.body.proposal = proposal;
        req.body.studentOID = new ObjectId(req.params.id);
        req.body.studyPlan = new ObjectId(req.body.studyPlan);

        const result = await db.collection('form').insertOne(req.body);
      
        // Find the student's supervisor
        const student = await db.collection('users').findOne({ _id: new ObjectId(req.params.id) });

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
            supervisor.email,
            'Form Approval Needed',
            emailContent
        );
 
         await db.collection('studyPlans').updateOne(
            { _id: new ObjectId(req.body.studyPlan) },
            { $set: { created: new Date() } }
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
        console.log(req.body.ids);
        if (role == 'supervisor') {
            const forms = await db.collection('form').find({
                studentOID: { $in: req.body.ids },
            }).toArray();
            res.json(forms);
        } else if (role == 'head') {
            const forms = await db.collection('form').find({
                'approval.supervisor.approval': { $exists: true },
                'approval.supervisor.approval': "approved"
            }).toArray();
            console.log(forms);
            res.json(forms);
        } else if (role == 'director') {
            const forms = await db.collection('form').find({
                'approval.supervisor.approval': 'approved',
                'approval.head.approval': 'approved'
            }).toArray();
            res.json(forms);
        }else if (role == 'admin') {
            const forms = await db.collection('form').find({
                'approval.supervisor.approval': 'approved',
                'approval.head.approval': 'approved',
                'approval.director.approval': 'approved'
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

        const student = await db.collection('users').findOne({ _id: new ObjectId(form.studentOID) });

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
                head.email,
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
            );
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

                    // Notify the director
                    const director = await db.collection('users').findOne({ isDirector: true });
                    await sendEmail(
                        director.email,
                        'Form Approval Needed',
                        `
                        <p>Dear ${director.name},</p>
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
                    );
                }
            } else if (user.isDirector) {
                if (form.approval.head.approval === 'approved') {
                    const director = { approval: req.body.approval, reason: req.body.reason };

                    const updateFields = { "approval.director": director };
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
                        <p>The form submitted by a student has been approved by the director and now requires your approval.</p>
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
                    );
                }
            } else if (user.isAdmin) {
                const admin = { approval: req.body.approval, reason: req.body.reason };

                // Fetch the current form to check adm1.approval
                const form = await db.collection('form').findOne({ _id: new ObjectId(formid) });

                if (form.approval.adm1.approval === 'approved') {
                    const updateFields = { "approval.adm2": admin, "status": "approved" };
                    if (req.body.approval === 'disapproved') {
                        updateFields.status = 'disapproved';
                        await db.collection('form').updateOne(
                            { _id: new ObjectId(formid) },
                            { $set: updateFields }
                        );
                    } else {
                        await db.collection('form').updateOne(
                            { _id: new ObjectId(formid) },
                            { $set: updateFields }
                        );
                        form.status = 'approved';
                        // Update studyPlan blueprint
                        const studyPlanId = form.studyPlan;
                        const studentId = form.studentOID;
                        console.log("studyplanID"+studyPlanId);
                        // Update student's studyPlan blueprint to true
                        await db.collection('studyPlans').updateMany(
                            { sid: new ObjectId(studentId) },
                            { $set: { current: false } }
                        );

                        // Update studyPlan blueprint to false
                        await db.collection('studyPlans').updateOne(
                            { _id: new ObjectId(studyPlanId) },
                            { $set: { approved: true, major: form.proposedMajor , current: true, approvedAt: new Date() }, $unset: { isDeclared: "" } }
                        );
            
                        await db.collection('users').updateOne(
                            { _id: new ObjectId(studentId) },
                            { $set: { major: form.proposedMajor } }
                        );
                    
                        await sendEmail(
                            student.email,
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
            const approverRole = approver.userRole || 'Unknown role';

            await sendEmail(
                student.email,
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
            const approverRole = approver.userRole || 'Unknown role';

            await sendEmail(
                student.email,
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
        res.json(updatedForm);
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});
module.exports = router;