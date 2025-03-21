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

module.exports = router;
