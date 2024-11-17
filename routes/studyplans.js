var express = require('express');
var router = express.Router();
const { connectToDB, ObjectId } = require('../utils/db');

// router.get('/:id', async function (req, res, next) {
//     const studentId = req.params.id;
//     let studyPlan = [];
//     const db = await connectToDB();

//     try {
//         studyPlan = await db.collection('studyPlans').findOne({ sid: new ObjectId(studentId) });
//         if (!studyPlan) {
//             return res.status(404).json({ error: 'Study plan not found for the given student ID' });
//         }
//     } catch (err) {
//         console.log(err);
//         return res.status(500).json({ error: err.toString() });
//     }

//     res.json(studyPlan);
// });

router.get('/:id', async function (req, res, next) {
    const studentId = req.params.id;
    let studyPlan = [];
    const db = await connectToDB();

    try {
        // studyPlan = await db.collection('studyPlans').findOne({ sid: new ObjectId(studentId) });
        studyPlan = await db.collection('projects').findOne({ 'member.0.id': new ObjectId(studentId) });

        if (!studyPlan) {
            return res.status(404).json({ error: 'Study plan not found for the given student ID' });
        }

        console.log(studyPlan);

        // Initialize an empty object to hold the reformatted study plan
        let reformattedStudyPlan = {
            studyPlan: {}
        };

        // Iterate through the study plan array
        studyPlan.progress.forEach(item => {
            // Create the year object if it doesn't exist
            if (!reformattedStudyPlan.studyPlan[`year${item.year}`]) {
                reformattedStudyPlan.studyPlan[`year${item.year}`] = {
                    semester1: [],
                    semester2: [],
                    units: 0
                };
            }

            // Push the reformatted item to the appropriate semester array
            reformattedStudyPlan.studyPlan[`year${item.year}`][`semester${item.semester}`].push({
                code: item.id,
                name: item.title,
                units: item.units
            });

            // Update the total units for the year
            reformattedStudyPlan.studyPlan[`year${item.year}`].units += item.units;
        });

        // Replace the studyPlan variable with the reformatted data
        studyPlan = reformattedStudyPlan;

        console.log("Reformatted", reformattedStudyPlan);

    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }

    res.json(studyPlan);
});


module.exports = router;