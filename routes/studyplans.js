var express = require('express');
var router = express.Router();
const { connectToDB, ObjectId } = require('../utils/db');

router.get('/:id', async function (req, res, next) {
    const studentId = req.params.id;
    let studyPlan = [];
    const db = await connectToDB();

    try {
        studyPlan = await db.collection('studyPlans').findOne({ sid: new ObjectId(studentId) });
        if (!studyPlan) {
            return res.status(404).json({ error: 'Study plan not found for the given student ID' });
        }
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }

    res.json(studyPlan);
});

module.exports = router;