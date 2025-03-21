const express = require('express');
const router = express.Router();
const cron = require('node-cron');
const { connectToDB } = require('../utils/db'); // Assuming a utility function to connect to the database

// Initialize a cron job to check for overdue notices every 12 hours
cron.schedule('0 */12 * * *', async () => {
    console.log('Cron job triggered: Running overdue notices check...');
    try {
        const db = await connectToDB();
        const now = new Date();

        // Find and update overdue notices
        const result = await db.collection('notices').updateMany(
            { due: { $lt: now }, overdue: { $ne: true } }, // Check if due date is in the past and overdue is not already set
            { $set: { overdue: true } }
        );

        console.log(`Overdue notices updated: ${result.modifiedCount}`);
    } catch (error) {
        console.error('Error in cron job:', error);
    }
});


module.exports = router;
