var express = require('express');
var router = express.Router();
const { connectToDB, ObjectId } = require('../utils/db');

router.get('/all/:id', async function (req, res, next) {
    const studentid = req.params.id;
    let modules = [];
    const db = await connectToDB();
    try {
        modules = await db.collection('modules')
            .find({ student: new ObjectId(studentid) })
            .project({ _id: 1, moduleName: 1, student: 1, sem: 1})
            .toArray();
        modules.sort((a, b) => a.sem.localeCompare(b.sem));
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
    res.json(modules);
});

router.get('/:id', async function (req, res, next) {
    const moduleid = req.params.id;
    let module = {};
    const db = await connectToDB();
    try {
        module = await db.collection('modules')
            .findOne({ _id: new ObjectId(moduleid) });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
    res.json(module);
});

module.exports = router;