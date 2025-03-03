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

/**
 * @route GET /studyPlans/:id
 * @description Get study plan for a specific student -> Reformat the Progress into a study Plan array for feeding..
 * @access Public
 */
router.get('/:id', async function (req, res, next) {
    const studentId = req.params.id;
    let ProgressStudyPlan = [];
    const db = await connectToDB();

    try {
        // studyPlan = await db.collection('studyPlans').findOne({ sid: new ObjectId(studentId) });
        ProgressStudyPlan = await db.collection('projects').findOne({ "sid": new ObjectId(studentId) });

        if (!ProgressStudyPlan) {
            return res.status(404).json({ error: 'Study plan not found for the given student ID' });
        }

        // Initialize an empty object to hold the reformatted study plan
        let reformattedStudyPlan = {
            studyPlan: {}
        };

        // Iterate through the study plan array
        ProgressStudyPlan.progress.forEach(item => {
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
                code: item.courseCode,
                name: item.title,
                units: item.units
            });

            // Update the total units for the year
            reformattedStudyPlan.studyPlan[`year${item.year}`].units += item.units;
        });

        // Replace the studyPlan variable with the reformatted data
        ProgressStudyPlan = reformattedStudyPlan;
        console.log("Reformatted", reformattedStudyPlan);
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
    res.json(ProgressStudyPlan);
});

router.get('/blueprints/:id', async function (req, res, next) {
    const db = await connectToDB();
    const id = req.params.id;
    try {
        const blueprints = await db.collection('projects').find({ sid: new ObjectId(id), blueprint: true }).toArray();
        return res.json(blueprints);
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});

router.get('/current/:id', async function (req, res, next) {
    const db = await connectToDB();
    const id = req.params.id;
    try {
        const current = await db.collection('projects').find({ sid: new ObjectId(id), blueprint: false }).toArray();
        return res.json(current);
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});
module.exports = router;