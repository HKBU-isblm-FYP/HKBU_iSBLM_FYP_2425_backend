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
    // await db.client.close();
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
    // await db.client.close();
  }
});

/**
 * Will need to restrucutre the study plan to accomodate the Y1S1, Y2S2 structure..
 */
router.post('/create', async (req, res) => {
  const project = req.body;
  console.log(project);

  // project.progress.forEach(x => {
  //   x.chapterId = new ObjectId(x.id);
  //   x.isCompleted = false;
  //   delete __rowKey;
  //   delete title;
  // })

  let tmp = [];

  project.progress.forEach((x, i) => {

    // console.log(x);
    let year = x.year;
    let semester = x.semester;

    x.data.forEach(e => {
      e.year = year;
      e.semester = semester;
      e.chapterId = new ObjectId(e.id);
      tmp.push(e);
      // project.progress[i].data.push(e);
      // console.log(e);
    })

    // project.progress[i] = {
    //   chapterId: new ObjectId(x.id),
    //   title: x.title,
    //   isCompleted: false,
    // }
  })

  // console.log(tmp);
  project.progress = tmp; //get the Flatten data;
  project.admissionYear = project.member[0].admissionYear; 
  project.year = project.member[0].year; 
  project.major = project.member[0].major; 
  project.semester = project.member[0].semester; 

  project.sid = project.member[0].id;

  project.blueprint = false;

  project.member.forEach((x, i) => {
    project.member[i] = {
      id: new ObjectId(x.id),
      name: x.name,
      sid: x.sid,
    }
  })



  const db = await connectToDB();
  // Insert the project data into MongoDB
  try {
    const result = await db.collection('studyPlans').insertOne(project);
    // const result = await db.collection('projects').insertOne(project);
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
  let projectId = req.body.projectId
  console.log('ProjectID', projectId);

  // handle files - > Must wait for file operation Over!
  let fileHandlingPromises = req.files.map((file) => {
    return new Promise((resolve, reject) => {
      //Relocate Files
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
          reject(err);
        } else {
          file.path = newDestination;
          console.log("Successfully moved the file!");
          console.log(newDestination);
          resolve(file);
        }
      });
    });
  });

  let filePaths;
  let imagePath;

  //Check New Path, and  Client.
  Promise.all(fileHandlingPromises)
    .then((files) => {
      //Prepare file paths
      filePaths = files.filter(file => file.fieldname === 'projectFile').map(file => file.path);
      imagePath = files.filter(file => file.fieldname === 'projectImage').map(file => file.path)[0];

      //Send file paths to client
      res.status(200).json({ message: "Uploaded Files!", filePaths: filePaths, imagePath: imagePath });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ message: "Error occurred while uploading files", error: err });
    });

  // SAVE The Path send to Mongo
  const db = await connectToDB();
  try {
    const project = await db.collection('projects').updateOne(
      { _id: new ObjectId(projectId) },
      {
        $set: {
          'documents.0.public': filePaths,
          image: imagePath
        }
      }
    );
    if (!project) {
      console.log("No such Project")
      return res.status(404).json({ message: 'Lesson not found' });
    }
  } catch (err) {
    console.log(err);
  } finally {
    // await db.client.close();
  }

  // save file to Backblaze B2... //LATER
});


module.exports = router;