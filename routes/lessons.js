var express = require('express');
var router = express.Router();
const { connectToDB, ObjectId } = require('../utils/db');

// Route to get all lessons with pagination
router.get('/all', async (req, res) => {
  const db = await connectToDB();

  try {
    const page = parseInt(req.query.page || 1) - 1;
    const size = parseInt(req.query.perPage || 6);

    const totalLessons = await db.collection('lessons').countDocuments();
    const totalPages = Math.ceil(totalLessons / size);

    const lessons = await db.collection('lessons')
      .find({})
      .skip(page * size)
      .limit(size)
      .toArray();

    res.json({ total_pages: totalPages, lessons: lessons });
  } catch (err) {
    // console.error(err);
    // res.json(err);
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    await db.client.close();
  }
});

router.get('/:id', async (req, res) => {
  console.log("Get Lessons");
  console.log(req.params.id);
  const db = await connectToDB();
  try {
    const lesson = await db.collection('lessons').findOne({ _id: new ObjectId(req.params.id) });
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    res.json(lesson);
  } catch (err) {
    console.log(err);
  } finally {
    await db.client.close();
  }
});

module.exports = router;