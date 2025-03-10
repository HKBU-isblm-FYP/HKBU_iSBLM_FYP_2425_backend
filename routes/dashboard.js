var express = require('express');
var router = express.Router();

const { connectToDB, ObjectId } = require('../utils/db');

// Route to get all lessons with pagination
router.get('/', async (req, res) => {
  console.log("Get Dashboard");
  const db = await connectToDB();

  try {
    const search = req.query.search || '';

    const countCourses = await db.collection('lessons').countDocuments();
    const countProjects = await db.collection('projects').countDocuments();
    const countUsers = await db.collection('users').countDocuments();

    const countSupervisors = await db.collection('users').countDocuments({ isSupervisor: true });

    //Here shall return the calcualted relevant data for the use of the frontend.

    const countStudentsByMajor = await db.collection('users').aggregate([
      { $match: { isStudent: true } }, // Filter for students
      { $group: { _id: "$major", count: { $sum: 1 } } } // Group by major and count
    ]).toArray();

    console.log(countStudentsByMajor);

    res.json({ courses: countCourses, projects: countProjects, users: countUsers, supervisors: countSupervisors, countStudentsByMajor: countStudentsByMajor });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    await db.client.close();
  }
});

module.exports = router;