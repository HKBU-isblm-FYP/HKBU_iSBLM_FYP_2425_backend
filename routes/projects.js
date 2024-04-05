var express = require('express');
var router = express.Router();
const { connectToDB, ObjectId } = require('../utils/db');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storePath = './uploads/projects';

// Configure Storage -> Multer don't Process text filed before file field- > it must be save first.
const projectFileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Set the destination of the file
    let dir = storePath;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    // Set the file name
    cb(null, file.originalname)
  }
});

// Initialize Multer with the storage engine
const uploadFile = multer({ storage: projectFileStorage });
const upload = multer();

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
    const projects = await db.collection('projects').aggregate(pipeline).toArray();
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

    const countResult = await db.collection('projects').aggregate(countPipeline).toArray();
    const totalProjects = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(totalProjects / perPage);

    res.json({ total_pages: totalPages, projects: projects, size: totalProjects });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Internal Server Error' });
  } finally {
    await db.client.close();
  }
});

router.get('/:id', async (req, res) => {
  console.log("Get Project");
  console.log(req.params.id);
  const db = await connectToDB();
  try {
    const project = await db.collection('projects').findOne({ _id: new ObjectId(req.params.id) });
    if (!project) {
      return res.status(404).json({ message: 'Lesson not found' });
    }
    res.json(project);
  } catch (err) {
    console.log(err);
  } finally {
    await db.client.close();
  }
});

router.post('/create', async (req, res) => {
  const project = req.body;

  const db = await connectToDB();
  // Insert the project data into MongoDB
  try {
    const result = await db.collection('projects').insertOne(project);
    const id = result.insertedId;

    res.json(id);
  } catch (error) {
    console.error(error);
  }
});

router.post('/createAttachments', uploadFile.any(), async (req, res) => {
  console.log("create Project");
  /**
   * 
  // TASKS:
  // TEXT: title/sturctre/ Lessons / progress/ memebers
  // B2: Image / documents

   * first create proejct with TEXT and JSON OBJECT,
   * Use its Object ID
   * 
   * Use Multer to upload the docs/img to uploads/projects/id/*repect-location*
   * 
   * Run B2 upload code on them, and save the b2 link to project in Mongo.
   * 
   * Note: I need to create the ID, then call this Route! -> so to pass req.body.projectId, as a part tof the multer save dir!
   */
  let projectImage = req.body.projectImage
  let projectId = req.body.projectId

  console.log('ProjectID', projectId);

  // handle files
  req.files.forEach((file, index) => {
    console.log(file);

    //Reloacte Files
    // Check fieldname and set new path
    let newDestination;
    if (file.fieldname === 'projectFile') {
      newDestination = `./uploads/projects/${projectId}/files/${file.filename}`;
    } else if (file.fieldname === 'projectImage') {
      newDestination = `./uploads/projects/${projectId}/img/${file.filename}`;
    }

    let oldDestination = file.path;

    // Create the directories if they don't exist
    let newDirectory = path.dirname(newDestination);
    if (!fs.existsSync(newDirectory)) {
      fs.mkdirSync(newDirectory, { recursive: true });
    }

    // Move the file to the new directory
    fs.rename(oldDestination, newDestination, function (err) {
      if (err) {
        console.error(err);
      } else {
        console.log("Successfully moved the file!");
      }
    });

  });

  // save file to Backblaze B2...




});

module.exports = router;