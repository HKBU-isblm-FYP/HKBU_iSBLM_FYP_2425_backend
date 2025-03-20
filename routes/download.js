var express = require('express');
var router = express.Router();
const { connectToDB, ObjectId } = require('../utils/db');
const {generateBlobSasUri } = require('../utils/azure-blob');

router.get('/:blobName', async function (req, res) {
  try {
    // Get the blob name
    console.log(1);
    const blobName = req.params.blobName;
    console.log(1);
    // Generate a SAS token
    const sasToken = generateBlobSasUri(blobName);
    console.log(1);
    // Return the SAS token
    return res.json(sasToken);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;