var express = require('express');
var router = express.Router();
const { connectToDB, ObjectId } = require('../utils/db');

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
  console.log("Get Lessons");
  console.log(req.params.id);
  const db = await connectToDB();
  try {
    const lesson = await db.collection('projects').findOne({ _id: new ObjectId(req.params.id) });
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