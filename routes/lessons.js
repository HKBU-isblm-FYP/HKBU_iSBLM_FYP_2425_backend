var express = require('express');
var router = express.Router();
const { connectToDB, ObjectId } = require('../utils/db');

// Route to get all lessons with pagination
router.get('/all', async (req, res) => {
  // console.log("Get All lessons");
  const db = await connectToDB();

  try {
    const search = req.query.search || '';

    let MECE = req.headers['x-mece'];
    MECE = MECE ? MECE.split(',').map(id => new ObjectId(id)) : []; //Need to be array to pass to $nin
    // console.log(MECE);

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
        $match: {
          _id: { $nin: MECE } // These are the Exclude IDS.
        }
      },
      {
        $skip: (page - 1) * perPage
      },
      {
        $limit: perPage
      }
    ];
    const lessons = await db.collection('lessons').aggregate(pipeline).toArray();
    let countPipeline = [
      {
        $match: search ? {
          title: { $regex: new RegExp(search, 'i') }
        } : {}
      },
      {
        $match: {
          _id: { $nin: MECE } // These are the Exclude IDS.
        }
      },
      {
        $count: "total"
      }
    ];

    const countResult = await db.collection('lessons').aggregate(countPipeline).toArray();
    const totalLessons = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(totalLessons / perPage);

    res.json({ total_pages: totalPages, lessons: lessons, size: totalLessons });
  } catch (err) {
    console.log(err);
    // res.json(err);
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    await db.client.close();
  }
});

router.get('/:id', async (req, res) => {
  // console.log("Get Lessons");
  // console.log(req.params.id);
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

router.post('/create', async (req, res) => {
  const lesson = req.body;

  // Insert the lesson data into MongoDB
  try {
    const result = await db.collection('lessons').insertOne(lesson);
    const id = result.insertedId;

    res.json(id);
  } catch (error) {
    console.error(error);
  }
});

module.exports = router;