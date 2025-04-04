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
    const search = req.query.search || '';
    const id = req.query.supervisor || '';
    const role = req.query.role || ''; // New role filter
    const page = parseInt(req.query.page || '1');
    const perPage = parseInt(req.query.perPage || '6');

    let query = {};
    if (search) {
      query.name = { $regex: new RegExp(search, 'i') };
    }
    if (role) {
      query.userRole = role; // Add role filter to query
    }

    let pipeline = [
      {
        $match: query
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
        $match: query
      },
      {
        $count: "total"
      }
    ];

    const countResult = await db.collection('users').aggregate(countPipeline).toArray();
    const totalUsers = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(totalUsers / perPage);

    // Include userRole in the response
    res.json({ total_pages: totalPages, users: users, size: totalUsers, perPage: perPage });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

router.get("/allUsers/", async (req, res) => {
  const db = await connectToDB();
  try {
    const users = await db.collection('users').find({}).toArray();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

router.get('/students', async (req, res) => {
  const db = await connectToDB();
  try {
    const page = parseInt(req.query.page || '1');
    const perPage = parseInt(req.query.perPage || '10');

    let query = { isStudent: true };

    let pipeline = [
      {
        $match: query
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
        $match: query
      },
      {
        $count: "total"
      }
    ];

    const countResult = await db.collection('users').aggregate(countPipeline).toArray();
    const totalUsers = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(totalUsers / perPage);

    // Add supervisorName to each user using a for loop
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      if (user.supervisor) {
        const sup = await db.collection('users').findOne({ _id: new ObjectId(user.supervisor) });
        user.supervisorName = sup ? sup.name : null;
      } else {
        user.supervisorName = null;
      }
    }

    res.json({ total_pages: totalPages, users: users, size: totalUsers, perPage: perPage });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});
router.get('/supervisors', async (req, res) => {
  const db = await connectToDB();
  try {
    const page = parseInt(req.query.page || '1');
    const perPage = parseInt(req.query.perPage || '10');

    let query = { isSupervisor: true };

    let pipeline = [
      {
        $match: query
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
        $match: query
      },
      {
        $count: "total"
      }
    ];

    const countResult = await db.collection('users').aggregate(countPipeline).toArray();
    const totalUsers = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(totalUsers / perPage);

    res.json({ total_pages: totalPages, supervisors: users, size: totalUsers, perPage: perPage });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

router.get('/all/form', async (req, res) => {
  const db = await connectToDB();
  try {
    const id = req.query.supervisor || '';
    let query = {};
    if (id) {
      query.supervisor = new ObjectId(id);
    }
    const users = await db.collection('users').find(query, {
      projection: { _id: 1, email: 1, name: 1 }
    }).toArray();

    res.json({ users: users });
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

// Get Supervisored Students by Sup's ID
router.get('/supervised-students/:supervisorId', async (req, res) => {
  const db = await connectToDB();
  try {
    const supervisorId = req.params.supervisorId;
    const students = await db.collection('users').find({ supervisor: new ObjectId(supervisorId) }).toArray();
    res.json({ students: students });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

router.put('/:supervisor/assign/:student', async (req, res) => {
  const db = await connectToDB();
  try {
    const supervisorId = req.params.supervisor;
    const studentId = req.params.student;
    const result = await db.collection('users').updateOne({ _id: new ObjectId(studentId) }, { $set: { supervisor: new ObjectId(supervisorId) } });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

// Create User
router.post('/create', async (req, res) => {
  const db = await connectToDB();
  try {
    const newUser = {
      ...req.body, // Accept user data from the request body
      _id: new ObjectId(), // Generate a new ObjectId for the user
      createdAt: new Date(),
      modifiedAt: new Date()
    };

    const result = await db.collection('users').insertOne(newUser);
    res.status(201).json({ message: 'User created successfully', userId: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).send({ message: 'Internal Server Error' });
  }
});

module.exports = router;
