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


// Route to get all projects with pagination
router.get('/all', async (req, res) => {
  const db = await connectToDB();
  try {

    const search = req.query.search || '';

    const perPage = parseInt(req.query.perPage || '6');
    const page = parseInt(req.query.page || 1);
    const size = parseInt(req.query.perPage || 6);

    let query = {};
    if (search) {
      query.title = { $regex: new RegExp(search, 'i') };
    }

    let pipeline = [
      {
        $match: search ? {
          title: { $regex: new RegExp(search, 'i') }
        } : {}
      },
      {
        $skip: (page - 1) * perPage
      },
      {
        $limit: perPage
      }
    ];
    const projects = await db.collection('studyPlans').aggregate(pipeline).toArray();
    let countPipeline = [
      {
        $match: search ? {
          title: { $regex: new RegExp(search, 'i') }
        } : {}
      },
      {
        $count: "total"
      }
    ];

    const countResult = await db.collection('studyPlans').aggregate(countPipeline).toArray();
    const totalProjects = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(totalProjects / perPage);

    res.json({ total_pages: totalPages, projects: projects, size: totalProjects });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Internal Server Error' });
  } finally {
    // await db.client.close();
  }
});

router.get('/:id', async (req, res) => {
  console.log("Get Project");
  console.log(req.params.id);
  const db = await connectToDB();
  try {
    const project = await db.collection('studyPlans').findOne({ _id: new ObjectId(req.params.id) });
    if (!project) {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    const userID =project.sid;
    const user = await db.collection('users').findOne({ _id: new ObjectId(userID) });

    project.user = user;
    res.json(project);
  } catch (err) {
    console.log(err);
  } finally {
    // await db.client.close();
  }
});

/**
 * @route GET /studyPlans/:id
 * @description Get study plan for a specific student -> Reformat the Progress into a study Plan array for feeding..
 * @access Public
 */
router.get('/bt/:id', async function (req, res, next) {
    const db = await connectToDB();
    const sid = req.params.id;
    try {
        const blueprints = await db.collection('studyPlans').find({ sid: new ObjectId(sid), blueprint: true }).toArray();
        console.log(blueprints)
        return res.json(blueprints);
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});

router.get('/ct/:id', async function (req, res, next) {
    const db = await connectToDB();
    const sid = req.params.id;

    try {
        const current = await db.collection('studyPlans').find({ sid: new ObjectId(sid), blueprint: false }).toArray();
        console.log(current)
        return res.json(current);
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});

router.get('/:id/:pid', async function (req, res, next) {
    const studentId = req.params.id;
    let ProgressStudyPlan = [];
    const db = await connectToDB();

    try {
        // studyPlan = await db.collection('studyPlans').findOne({ sid: new ObjectId(studentId) });
        ProgressStudyPlan = await db.collection('studyPlans').findOne({ sid: new ObjectId(studentId), _id: new ObjectId(req.params.pid) });
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



module.exports = router;