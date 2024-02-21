// This return the Converted Markdown format of the MONGODB OBJECT

var express = require('express');
var router = express.Router();

const json2md = require("json2md")
const json2md_conf = require('../utils/json2md_conf'); //I am storing the config in another file - call this to add conf to json2md

const { generateToken } = require('../utils/auth');
const { connectToDB, ObjectId } = require('../utils/db');

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/lesson/:id', async (req, res) => {
  console.log("Get Lessons MD format");
  console.log(req.params.id);
  const db = await connectToDB();
  try {
    const lesson = await db.collection('lessons').findOne({ _id: new ObjectId(req.params.id) });
    if (!lesson) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    delete lesson._id;

    // console.log(json2md);
    // console.log(json2md_conf);
    // res.json(lesson);

    console.log(lesson);
    const lesson_md = json2md(lesson);

    console.log(lesson_md);

    res.json(lesson_md); //Using Custom type for lesson.

  } catch (err) {
    console.log(err);
  } finally {
    await db.client.close();
  }
});

module.exports = router;