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

/**
 * Get the Annotation Data from Mongo to Tiptap Of a Lesson
 */
router.get('/getAnnotation/:id', async (req, res) => {
  console.log('getAttn')
  const lessonId = req.params.id;
  console.log('lessibId', lessonId);

  // Connect to the MongoDB database
  const db = await connectToDB();
  try {
    // Assuming 'attn' has an '_id' field to identify the document
    const filter = { _id: new ObjectId(lessonId) };

    // Fetch the document with the specified _id
    const doc = await db.collection('lessons').findOne(filter);

    console.log(doc);

    if (doc) {
      // If the document exists, send the annotations to the client
      res.json(doc.annotations);
    } else {
      // If the document does not exist, send an appropriate message to the client
      res.status(404).json({ message: 'Document not found' });
    }
  } catch (error) {
    console.error(error);
  }
});

/**
 * Save the Annotation Data from TipTap to mongo of a Lesson
 * 
 *  * Obj is defined as:
 *     const attnObj = {
 *      id: userId,
 *      annotations: annotationStore.annotations
 *  }
 * 
 */
router.patch('/updateAnnotation/:id', async (req, res) => {
  console.log('updateAttn')
  const attn = req.body;
  const lessonId = req.params.id;
  console.log('attn Object', attn);
  console.log('LessonID', lessonId);

  const db = await connectToDB();

  try {


    const filter = { _id: new ObjectId(lessonId), "annotations.userId": new ObjectId(attn.userId) }; // lessonID and userId

    // Check if the document with the specified lessonId and userId exists
    const doc = await db.collection('lessons').findOne(filter);

    if (doc) {
      // Assuming 'attn' has an '_id' field to identify the document
      const update = {
        $set: {
          "annotations.$.userAnnotations": // array of annotations
            attn.userAnnotations
        }
      };
      const options = { upsert: true };
      const result = await db.collection('lessons').updateOne(filter, update, options);
      res.json(result);

    } else {
      // If the document does not exist, add a new annotation for the user
      const result = await db.collection('lessons').updateOne(
        { _id: new ObjectId(lessonId) },
        { $push: { annotations: { userId: new ObjectId(attn.userId), userAnnotations: attn.userAnnotations } } }
      );
      res.json(result);
    }

    // res.json(result);
  } catch (error) {
    console.error(error);
  }
});

module.exports = router;