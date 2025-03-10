var express = require('express');
var router = express.Router();
const path = require('path'); // Import the path module

const { generateToken } = require('../utils/auth');
const { connectToDB, ObjectId } = require('../utils/db');

/* GET home page. */
router.get('/', function (req, res, next) {
  // res.render('index', { title: 'Express' });
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html')); // Send the index.html file from the dist directory
});

router.post('/api/login', async function (req, res, next) {
  const db = await connectToDB();
  try {
    // check if the user exists
    var user = await db.collection("users").findOne({ email: req.body.email });
    if (!user) {
      res.status(401).json({ message: 'User not found' });
      return;
    }

    // check if the password matches
    if (req.body.password !== user.password) {
      res.status(401).json({ message: 'Invalid password' });
      return;
    }

    delete user.ip_address;
    delete user.password; //remove password before send out.


    // generate a JWT token
    const token = generateToken(user);

    // return the token
    res.json({ token: token });

  } catch (err) {
    res.status(400).json({ message: err.message });
  } finally {
    // await db.client.close();
  }
});

module.exports = router;
