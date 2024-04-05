// This use (MARKED) package to convert md to JSON AND SAVE THE MD CONTENT EDITOR back to MONGODB OBJECT

var express = require('express');
var router = express.Router();

const marked = require('marked');
const { connectToDB, ObjectId } = require('../utils/db');

//Update Lesson record according to MD editor's Update
router.patch('/lesson/:id', async (req, res) => {

  const lessonId = req.params.id;

  console.log(`PATCH Lesson ${lessonId} in JSON FROMAT`);
  console.log(lessonId);
  console.log('update body', req.body);

  const db = await connectToDB();
  try {

    let result = await db.collection("lessons").updateOne({ _id: new ObjectId(lessonId) },
      {
        $set: { 
          updatedBy: new ObjectId(req.user._id),
          updatedAt: new Date() // Add this line
         }
      });

    if (result.modifiedCount > 0) {
      console.log('Updated')
      res.status(200).json({ message: "Lesson updated" });
    } else {
      console.log('Failed Updated')
      res.status(304).json({ message: "Lesson not found" });
    }

  } catch (err) {
    console.log(err);
  } finally {
    await db.client.close();
  }
});

module.exports = router;