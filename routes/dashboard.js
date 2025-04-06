var express = require('express');
var router = express.Router();

const { connectToDB, ObjectId } = require('../utils/db');

// Route to get information to fill in Admin Dashboard
router.get('/:selectedYear', async (req, res) => {
  console.log("Get Admin Dashboard");
  const db = await connectToDB();

  try {
    const search = req.query.search || '';

    const countCourses = await db.collection('courses').countDocuments();
    const countProjects = await db.collection('projects').countDocuments();
    const countUsers = await db.collection('users').countDocuments();

    const countStudents = await db.collection('users').countDocuments({ isStudent: true });

    const countStudentsByYearArray = await db.collection('users').aggregate([
      { $match: { isStudent: true, admissionYear: req.params.selectedYear } }, // Filter for students 
      { $group: { _id: "$years", count: { $sum: 1 } } } // Group by major and count
    ]).toArray();
    const countStudentsByYear = countStudentsByYearArray.length > 0 ? countStudentsByYearArray[0].count : 0;

    console.log(countStudentsByYear);

    const countCourseByYearArray = await db.collection('courses').aggregate([
      { $match: { years: req.params.selectedYear } }, // Filter for students
      { $group: { _id: "$years", count: { $sum: 1 } } } // Group by major and count
    ]).toArray();
    const countCourseByYear = countCourseByYearArray.length > 0 ? countCourseByYearArray[0].count : 0;
    console.log(countCourseByYearArray);

    // const countSupervisors = await db.collection('users').countDocuments({ isSupervisor: true });

    const countSupervisors = await db.collection('users').aggregate([
      { $match: { isSupervisor: true } }, // Filter for students
    ]).toArray();

    //Here shall return the calcualted relevant data for the use of the frontend.
    let countStudentsByMajorArray = await db.collection('users').aggregate([
      { $match: { isStudent: true, major: { $ne: null }, admissionYear: req.params.selectedYear } }, // Filter for students
      { $group: { _id: "$major", count: { $sum: 1 } } } // Group by major and count
    ]).toArray();
    console.log(countStudentsByMajorArray);

    if (countStudentsByMajorArray.length === 0) {
      countStudentsByMajorArray = await db.collection('users').aggregate([
        { $match: { isStudent: true, major: { $ne: null } } }, // Filter for students
        { $group: { _id: "$major", count: { $sum: 0 } } } // Group by major and count
      ]).toArray();
    }

    res.json({
      courses: countCourseByYear, projects: countProjects, users: countUsers,
      supervisors: countSupervisors, students: countStudentsByYear, countStudentsByMajor: countStudentsByMajorArray
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    // await db.client.close();
  }
});


// Route to get information to fill student dashboard
router.get('/student/:sid', async (req, res) => {
  console.log("Get Student Dashboard");
  const db = await connectToDB();

  try {
    const search = req.query.search || '';
    const studentId = req.params.sid;
    console.log("Student ID: ", studentId);
    // const studentId = new ObjectId(req.params.sid);

    const student = await db.collection('users').findOne({ _id: new ObjectId(studentId) });
    const supervisor = await db.collection('users').findOne({ _id: new ObjectId(student.supervisor) });

    delete student.password;
    delete supervisor.password;

    const countCourses = await db.collection('courses').countDocuments();

    res.json({ student: student, supervisor: supervisor, totalCourses: 89 });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    // await db.client.close();
  }
});

module.exports = router;