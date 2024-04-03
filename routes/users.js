var express = require('express');
var router = express.Router();
const { connectToDB, ObjectId } = require('../utils/db');

/* GET users listing. */
router.get('/', function (req, res, next) {
  res.send('respond with a resource');
})

// Get All Users
router.get('/all', async (req, res) => {
  const db = await connectToDB();
  try {

    //Fix Search Query
    const search = req.query.search || '';

    const page = parseInt(req.query.page || '1');
    const perPage = parseInt(req.query.perPage || '6');

    let query = {};
    if (search) {
      query.name = { $regex: new RegExp(search, 'i') };
    }

    let pipeline = [
      {
        $match: search ? {
          name: { $regex: new RegExp(search, 'i') }
        } : {}
      },
      {
        $skip: (page - 1) * perPage
      },
      {
        $limit: perPage
      }
    ];
    const users = await db.collection('users').aggregate(pipeline).toArray();
    let countPipeline = [
      {
        $match: search ? {
          name: { $regex: new RegExp(search, 'i') }
        } : {}
      },
      {
        $count: "total"
      }
    ];

    const countResult = await db.collection('users').aggregate(countPipeline).toArray();
    const totalUsers = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(totalUsers / perPage);


    res.json({ total_pages: totalPages, users: users, size: totalUsers, perPage: perPage });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

// Get User by ID
router.get('/detail/:id', async (req, res) => {
  const db = await connectToDB();
  try {
    const userID = req.params.id;
    const user = await db.collection('users').findOne({ _id: new ObjectId(userID) });
    if (!user) {
      res.status(404).send({ message: 'User not found' });
    } else {
      res.json(user);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

module.exports = router;
