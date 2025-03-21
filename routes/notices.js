const express = require('express');
const router = express.Router();
const cron = require('node-cron');
const { connectToDB } = require('../utils/db'); // Assuming a utility function to connect to the database

// Initialize a cron job to check for overdue notices every 12 hours
cron.schedule('* * * * *', async () => {
    console.log('Cron job triggered: Running overdue notices check...');
    try {
        const db = await connectToDB();
        const now = new Date();

        // Find and update overdue notices
        const overdueResult = await db.collection('notices').updateMany(
            { due: { $lt: now }, overdue: { $ne: true } }, // Check if due date is in the past and overdue is not already set
            { $set: { overdue: true } }
        );

        // Reset overdue field if due date is updated to a future date
        const resetResult = await db.collection('notices').updateMany(
            { due: { $gte: now }, overdue: true }, // Check if due date is in the future and overdue is true
            { $set: { overdue: false } }
        );

        console.log(`Overdue notices updated: ${overdueResult.modifiedCount}`);
        console.log(`Overdue notices reset: ${resetResult.modifiedCount}`);
    } catch (error) {
        console.error('Error in cron job:', error);
    }
});

// Endpoint to update the due date and time for the form
router.post('/update-due-time', async (req, res) => {
    const { dueDate, dueTime } = req.body;

    if (!dueDate || !dueTime) {
        return res.status(400).json({ message: 'Both due date and time are required.' });
    }

    try {
        const due = new Date(`${dueDate}T${dueTime}:00.000Z`); // Combine date and time into a single ISO string
        const db = await connectToDB();
        const result = await db.collection('notices').updateOne(
            { type: 'allForm' }, // Update the single document with type "allForm"
            { $set: { due } }
        );

        res.status(200).json({ message: 'Due date and time updated successfully.', modifiedCount: result.modifiedCount });
    } catch (error) {
        console.error('Error updating due date and time:', error);
        res.status(500).json({ message: 'Failed to update due date and time.' });
    }
});

// Endpoint to get students who have not submitted the declaration form, without a major, and overdue
router.get('/students/not-submitted-overdue', async (req, res) => {
    try {
        const db = await connectToDB();

        // Fetch the due date for the "allForm" notice
        const notice = await db.collection('notices').findOne({ type: 'allForm' });
        if (!notice || !notice.due) {
            return res.status(400).json({ message: 'No due date found for allForm notice.' });
        }
        const dueDate = new Date(notice.due);

        // Find students who meet the criteria
        const students = await db.collection('users').aggregate([
            {
                $lookup: {
                    from: 'form',
                    localField: '_id',
                    foreignField: 'studentID',
                    as: 'forms'
                }
            },
            {
                $match: {
                    isStudent: true,
                    major: { $exists: false }, // Students without a major
                    'forms.type': { $ne: 'Declaration Form' }, // Students who have not submitted the declaration form
                    createdAt: { $lt: dueDate } // Students overdue for the form
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    email: 1,
                    studentNumber: 1,
                    createdAt: 1,
                    major: 1
                }
            }
        ]).toArray();

        res.status(200).json(students);
    } catch (error) {
        console.error('Error fetching students who have not submitted the declaration form and are overdue:', error);
        res.status(500).json({ message: 'Failed to fetch students.' });
    }
});

module.exports = router;
