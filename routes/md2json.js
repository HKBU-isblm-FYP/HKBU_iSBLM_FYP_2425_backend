// This use (MARKED) package to convert md to JSON AND SAVE THE MD CONTENT EDITOR back to MONGODB OBJECT

var express = require('express');
var router = express.Router();

const marked = require('marked');
const { connectToDB, ObjectId } = require('../utils/db');

//Update Lesson record according to MD editor's Update
router.patch('/lesson/:id', async (req, res) => {
  console.log("PATCH Lessons in JSON FROMAT");
  console.log(req.params.id);
  console.log(req.body);

  const db = await connectToDB();
  try {

    let result = await db.collection("lessons").updateOne({ _id: new ObjectId(req.params.id) },
      {
        $set: { manager: new ObjectId(req.user._id) }
      });

    if (result.modifiedCount > 0) {
      res.status(200).json({ message: "Lesson updated" });
    } else {
      res.status(304).json({ message: "Lesson not found" });
    }

  } catch (err) {
    console.log(err);
  } finally {
    await db.client.close();
  }
});

module.exports = router;