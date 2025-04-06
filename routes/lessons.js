var express = require('express');
var router = express.Router();

const { connectToDB, ObjectId } = require('../utils/db');

const multer = require('multer');
const upload = multer(); //HANDLE TEXT ONLY

// Route to get all lessons with pagination
router.get('/all', async (req, res) => {
  // console.log("Get All lessons");
  const db = await connectToDB();

  try {
    const search = req.query.search || '';
    const years = req.query.years; // Get the year from query parameters

    let MECE = req.headers['x-mece'];
    MECE = MECE ? MECE.split(',').map(id => new ObjectId(id)) : []; //Need to be array to pass to $nin
    console.log('MECE', MECE);

    const perPage = parseInt(req.query.perPage || '6');
    const page = parseInt(req.query.page || 1);
    const size = parseInt(req.query.perPage || 6);

    const admissionYear = req.query.admissionYear || ''; // Get the admission year from the request parameters

    let query = {};
    if (search) {
      query.title = { $regex: new RegExp(search, 'i') }; // Filter by title
    }
    if (years) {
      query.years = years; // Filter by years
    }

    if (admissionYear) {
      query.years = admissionYear; // Filter by admission year
    }

    let pipeline = [
      {
        $match: {
          ...query, // Include both title and year filters
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
        $match: {
          ...query, // Include both title and year filters
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
    // await db.client.close();
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
    // await db.client.close();
  }
});

router.post('/create', upload.none(), async (req, res) => {
  //This formData is text only;
  const lesson = req.body;

  // Convert isPublic to boolean
  lesson.isPublic = lesson.isPublic === 'true';
  lesson.createdAt = new Date();

  console.log(lesson);

  // Insert the lesson data into MongoDB
  const db = await connectToDB();

  const existingLesson = await db.collection('lessons').findOne({
    title: lesson.title,
    isPublic: lesson.isPublic
  });

  if (existingLesson) {
    return res.status(400).json({ message: 'Lesson already exists' });
  }

  try {
    const result = await db.collection('lessons').insertOne(lesson);
    const id = result.insertedId;

    res.json(id);
  } catch (error) {
    console.error(error);
  }
});

/**
 * VUE Send the Update MD to here, Patch the md field.
 */
router.patch('/updateMD/:id', async (req, res) => {
  console.log('UpdateMD')
  const lesson = req.body;
  const id = req.params.id;
  // console.log(lesson);
  // console.log(id);

  // Connect to the MongoDB database
  const db = await connectToDB();
  try {
    // Assuming 'lesson' has an '_id' field to identify the document
    const filter = { _id: new ObjectId(id) };
    const update = { $set: { md: lesson.md } };

    const result = await db.collection('lessons').updateOne(filter, update);
    res.json(result);
  } catch (error) {
    console.error(error);
  }
});

/**
 * Send the parsed HTML preview content to here for TipTap annotation.
 */
router.patch('/updateHTML/:id', async (req, res) => {
  console.log('UpdateHTML')
  const lesson = req.body;
  const id = req.params.id;
  console.log(lesson);
  console.log(id);
  // Connect to the MongoDB database
  const db = await connectToDB();
  try {
    // Assuming 'lesson' has an '_id' field to identify the document
    const filter = { _id: new ObjectId(id) };
    const update = { $set: { html: lesson.html } };

    const result = await db.collection('lessons').updateOne(filter, update);
    res.json(result);
  } catch (error) {
    console.error(error);
  }
});

router.post('/default', async (req, res) => {

  const db = await connectToDB();

  try {
    const defaultLessons = req.body; // Parse the studyPlan from the request body

    const admissionYear = req.query.admissionYear; // Get the admission year from the request parameters

    console.log(defaultLessons);
    // const courseCodes = Object.values(defaultLessons).flat().map(course => course.courseCode);

    // Extract course codes and filter out invalid ones
    const courseCodes = Object.values(defaultLessons)
      .flat()
      .map(course => course.courseCode)
      .flatMap(code => code.includes('&') ? code.split('&').map(c => c.trim()) : code) // Split codes with '&'
      .filter(code => code && !['FREE', 'EXCHANGE', 'GCAP'].includes(code) && !code.includes('&'));

    console.log(courseCodes);

    // const lessons = await db.collection('lessons').find({ courseCode: { $in: courseCodes } }, { projecttion: { _id: 1 } }).select('_id');
    const lessons = await db
      .collection('lessons')
      .find({ courseCode: { $in: courseCodes }, years: admissionYear }, { projection: { _id: 1, courseCode: 1, title: 1, units: 1 } }) // Use projection to select only '_id'
      .toArray();

    console.log(lessons);
    console.log(admissionYear);

    res.json(lessons);
  } catch (error) {
    res.status(500).json({ error: `'Failed to fetch lessons' ${error}` });
  }
});

module.exports = router;