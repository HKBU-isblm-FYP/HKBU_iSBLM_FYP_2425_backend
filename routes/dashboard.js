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

    res.json({courses: countCourses, projects: countProjects, users: countUsers });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    await db.client.close();
  }
});

module.exports = router;