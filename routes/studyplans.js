var express = require('express');
var router = express.Router();
const { connectToDB, ObjectId } = require('../utils/db');
const { sendEmail } = require('../utils/emailServices.js');
const { initialize } = require('passport');
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

router.get('/pending', async function (req, res, next) {
  const db = await connectToDB();
  try {
    const blueprints = await db.collection('studyPlans').find({ approved: false, "approval": { $exists: true } }).toArray();
    console.log(blueprints);
    return res.json(blueprints);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: err.toString() });
  }
});

router.get('/:sid/current', async function (req, res, next) {
  const db = await connectToDB();
  const sid = req.params.sid;
  try {
    const current = await db.collection('studyPlans').find({ sid: new ObjectId(sid), approved: true, current: true }).toArray();
    console.log(current)
    return res.json(current);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: err.toString() });
  }
}); 

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
    const userID = project.sid;
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
router.get('/draft/:id', async function (req, res, next) {
  const db = await connectToDB();
  const sid = req.params.id;
  try {
    const blueprints = await db.collection('studyPlans').find({ sid: new ObjectId(sid), approved: false }).toArray();
    console.log(blueprints)
    return res.json(blueprints);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: err.toString() });
  }
});

router.get('/approved/:id', async function (req, res, next) {
  const db = await connectToDB();
  const sid = req.params.id;

  try {
    const current = await db.collection('studyPlans').find({ sid: new ObjectId(sid), approved: true }).toArray();
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

  console.log(studentId, req.params.pid);

  try {
    // studyPlan = await db.collection('studyPlans').findOne({ sid: new ObjectId(studentId) });
    ProgressStudyPlan = await db.collection('studyPlans').findOne({ sid: new ObjectId(studentId), _id: new ObjectId(req.params.pid) });
    console.log(ProgressStudyPlan);
    if (!ProgressStudyPlan) {
      return res.status(404).json({ error: 'Study plan not found for the given student ID' });
    }

    // Initialize an empty object to hold the reformatted study plan
    let reformattedStudyPlan = {
      studyPlan: {}
    };

    console.log('ORIGINAL', JSON.stringify(ProgressStudyPlan, null, 2));

    ProgressStudyPlan.member[0] = await db.collection('users').findOne({ _id: new ObjectId(studentId) });

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
        code: item.courseCode || item.code,
        name: item.title,
        units: item.units,
        id: item.chapterId
      });

      // Update the total units for the year
      reformattedStudyPlan.studyPlan[`year${item.year}`].units += item.units;
    });

    // Replace the studyPlan variable with the reformatted data
    ProgressStudyPlan = reformattedStudyPlan;

    ProgressStudyPlan.createdAt = ProgressStudyPlan.createdAt || new Date();

    console.log("Reformatted", reformattedStudyPlan);
    console.log(JSON.stringify(ProgressStudyPlan, null, 2));
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: err.toString() });
  }
  res.json(ProgressStudyPlan);
});




function reconstructStudyplan(studyplan) {
  // Flatten the progress data
  let tmp = [];
  studyplan.progress.forEach((x) => {
    let year = x.year;
    let semester = x.semester;

    x.data.forEach(e => {
      e.year = year;
      e.semester = semester;
      e.chapterId = new ObjectId(e.id);
      tmp.push(e);
    });
  });

  // Construct the new study plan structure
  const newStudyPlan = {
    title: studyplan.title,
    structure: studyplan.structure || "Default Structure",
    member: studyplan.member,
    sid: new ObjectId(studyplan.member[0].id),
    progress: tmp,
    admissionYear: studyplan.member[0].admissionYear,
    year: studyplan.member[0].year,
    major: studyplan.member[0].major,
    semester: studyplan.member[0].semester,
    approved: false,
    current: false,
    isDeclared: true
  };
  return newStudyPlan;
}

/**
 * Will need to restrucutre the study plan to accomodate the Y1S1, Y2S2 structure..
 */
router.post('/create', async (req, res) => {
  const studyplan = req.body;
  console.log(studyplan);

  // Construct the new study plan structure
  const newStudyPlan = reconstructStudyplan(studyplan);

  const db = await connectToDB();
  try {
    const result = await db.collection('studyPlans').insertOne(newStudyPlan);
    const id = result.insertedId;

    // Update the user's initiated studyPlan field 
    const userId = newStudyPlan.sid;
    await db.collection('users').updateOne(
      { _id: userId },
      { $set: { initiated: true } }
    );

    res.json(id);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @route PUT /studyPlans/:id
 * @description Update an entire study plan by its ID
 * @access Public
 */
router.post('/update/:id', async (req, res) => {
  const studyPlanId = req.params.id;
  let updatedStudyPlan = req.body;
  console.log("Update Study Plan", updatedStudyPlan);

  // Construct the new study plan structure
  updatedStudyPlan = reconstructStudyplan(updatedStudyPlan);

  const db = await connectToDB();
  try {
    const result = await db.collection('studyPlans').updateOne(
      { _id: new ObjectId(studyPlanId) },
      { $set: updatedStudyPlan }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Study plan not found' });
    }

    // Update the user's initiated studyPlan field 
    const userId = updatedStudyPlan.sid;
    await db.collection('users').updateOne(
      { _id: userId },
      { $set: { initiated: true } }
    );

    res.json({ message: 'Study plan updated successfully' });
  } catch (err) {
    console.error(err);
    console.log(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/approval', async (req, res) => {
  const db = await connectToDB();
  let studyPlan = req.body;

  // Remove the original _id
  delete studyPlan._id;

  // Reconstruct the study plan object
  studyPlan = reconstructStudyplan(studyPlan);

  // Set additional fields for approval
  studyPlan.approved = false;
  studyPlan.current = false;
  studyPlan.approval = {
    supervisor: false,
    head: false,
    admin: false
  };
  studyPlan.created = new Date();
  delete studyPlan.isDeclared;

  try {
    const result = await db.collection('studyPlans').insertOne(studyPlan);

    // Fetch the student using the `sid` field in the study plan
    const student = await db.collection('users').findOne({ _id: new ObjectId(studyPlan.sid) });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Fetch the supervisor using the `supervisor` field in the student document
    const supervisor = await db.collection('users').findOne({ _id: new ObjectId(student.supervisor) });
    if (supervisor) {
      const emailContent = `
        <p>Dear ${supervisor.name},</p>
        <p>A new study plan has been submitted by your student, <strong>${student.name}</strong>, and requires your approval.</p>
        <p>Study Plan Title: ${studyPlan.title}</p>
        <p>Please review and approve the study plan at your earliest convenience.</p>
        <p>Thank you.</p>
        <p>Best regards,</p>
        <p>Your University Administration</p>
      `;
      await sendEmail(supervisor.email, 'Study Plan Approval Needed', emailContent);
    }

    res.json({ message: 'Study plan inserted successfully', id: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.put('/:studyPlanID/approval/:uid', async (req, res) => {
  const db = await connectToDB();
  const studyPlanID = req.params.studyPlanID;
  const uid = req.params.uid;

  try {
    // Fetch the study plan
    const studyPlan = await db.collection('studyPlans').findOne({ _id: new ObjectId(studyPlanID) });
    if (!studyPlan) {
      return res.status(404).json({ error: 'Study plan not found' });
    }

    // Fetch the user making the approval
    const user = await db.collection('users').findOne({ _id: new ObjectId(uid) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Determine the role of the approver and update the corresponding approval field
    let updateFields = {};
    if (user.isSupervisor) {
      updateFields = { "approval.supervisor": { approval: req.body.approval, reason: req.body.reason } };
    } else if (user.isHead) {
      if (studyPlan.approval.supervisor?.approval === "approved") {
        updateFields = { "approval.head": { approval: req.body.approval, reason: req.body.reason } };
      } else {
        return res.status(400).json({ error: 'Supervisor approval is required first' });
      }
    } else if (user.isAdmin) {
      if (studyPlan.approval.head?.approval === "approved") {
        updateFields = { "approval.admin": { approval: req.body.approval, reason: req.body.reason } };
      } else {
        return res.status(400).json({ error: 'Head approval is required first' });
      }
    } else {
      return res.status(403).json({ error: 'User is not authorized to approve this study plan' });
    }

    // Update the study plan approval status
    if (req.body.approval === "approved") {
      if (user.isAdmin) {
        updateFields.approved = true;
        updateFields.current = true;
        updateFields.approvedAt = new Date();

        // Set all other study plans for the student to `current: false`
        await db.collection('studyPlans').updateMany(
          { sid: studyPlan.sid, _id: { $ne: new ObjectId(studyPlanID) } },
          { $set: { current: false } }
        );
      }
    } else {
      updateFields.approved = false;
      updateFields.current = false;
    }

    await db.collection('studyPlans').updateOne(
      { _id: new ObjectId(studyPlanID) },
      { $set: updateFields }
    );

    // Notify the next approver
    if (req.body.approval === "approved") {
      if (user.isSupervisor) {
        const head = await db.collection('users').findOne({ isHead: true });
        if (head) {
          const emailContent = `
            <p>Dear ${head.name},</p>
            <p>The study plan titled <strong>${studyPlan.title}</strong> has been approved by the supervisor and now requires your approval.</p>
            <p>Please review and approve the study plan at your earliest convenience.</p>
            <p>Thank you.</p>
            <p>Best regards,</p>
            <p>Your University Administration</p>
          `;
          await sendEmail(head.email, 'Study Plan Approval Needed', emailContent);
        }
      } else if (user.isHead) {
        const admin = await db.collection('users').findOne({ isAdmin: true });
        if (admin) {
          const emailContent = `
            <p>Dear ${admin.name},</p>
            <p>The study plan titled <strong>${studyPlan.title}</strong> has been approved by the head and now requires your approval.</p>
            <p>Please review and approve the study plan at your earliest convenience.</p>
            <p>Thank you.</p>
            <p>Best regards,</p>
            <p>Your University Administration</p>
          `;
          await sendEmail(admin.email, 'Study Plan Approval Needed', emailContent);
        }
      }
    }

    // Notify the student about the approval status
    const student = await db.collection('users').findOne({ _id: studyPlan.sid });
    if (student) {
      const status = req.body.approval === "approved" ? 'approved' : 'disapproved';
      const emailContent = `
        <p>Dear ${student.name},</p>
        <p>Your study plan titled <strong>${studyPlan.title}</strong> has been <strong>${status}</strong>.</p>
        <p>Reason: ${req.body.reason || 'No reason provided'}.</p>
        <p>Thank you.</p>
        <p>Best regards,</p>
        <p>Your University Administration</p>
      `;
      await sendEmail(student.email, 'Study Plan Approval Status', emailContent);
    }

    res.json({ message: 'Approval status updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


module.exports = router;