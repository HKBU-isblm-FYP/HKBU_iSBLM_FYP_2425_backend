var express = require('express');
var router = express.Router();

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const mime = require('mime-types');

const multer = require('multer');
const upload = multer({ dest: 'uploads/textbooks/' });

const { generateToken } = require('../utils/auth');
const { connectToDB, ObjectId } = require('../utils/db');

router.get('/all', async (req, res) => {

    const db = await connectToDB();
    try {
        const page = parseInt(req.query.page || '1');
        const size = parseInt(req.query.perPage || '6');
        const totalTextbooks = await db.collection('textbooks').countDocuments();
        const totalPages = Math.ceil(totalTextbooks / size);
        console.log(db);
        const textbooks = await db.collection('textbooks')
            .find({})
            .skip((page - 1) * size)
            .limit(size)
            .toArray();
        // res.send(textbooks);
        res.json({ totalPages: totalPages, textbooks: textbooks });
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Internal Server Error' });
    }
});

router.get('/get/:id', async (req, res) => {
    const db = await connectToDB();
    try {
        const textbooks = await db.collection('textbooks').findOne({ _id: new ObjectId(req.params.id) });
        // res.send(textbooks);
        res.json(textbooks);
    } catch (err) {
        console.error(err);
        res.status(500).send({ message: 'Internal Server Error' });
    }
});

router.post('/create', async (req, res) => {
    const db = await connectToDB();
    const { id, name, md } = req.body;

    const textbook = {
        _id: new ObjectId(),
        md: md,
        name: name
    };

    const result = await db.collection('textbooks').insertOne(textbook);
    res.json(result);
});

router.post('/convert-create', upload.single('file'), async (req, res) => {
    console.log("Convert-create")
    const db = await connectToDB();

    //Need to check if it is PDF -> Then PDFplumber + Pandoc
    //DOCX -> Only Pandoc.

    try {
        const { name } = req.body;
        const file = req.file;
        // console.log(name);
        // console.log(file);
        const extension = mime.extension(file.mimetype);
        const parentDirPath = path.resolve(__dirname, '../'); //Remove go backup one level

        const filePath = path.join(parentDirPath, file.path);
        const outputDirectory = path.join(parentDirPath, '/uploads/textbooks/converted/');
        const outputFileName = `${file.originalname.replace(/'/g, "\\'")}.md`; // escape single quotes in the filename
        // const outputFilePath = path.join(outputDirectory, outputFileName);
        // const outputFilePath = `${outputDirectory}${file.originalname}.md`;
        const outputFilePath = path.join(outputDirectory, `${name}.md`);

        // Check if the directory exists
        if (!fs.existsSync(outputDirectory)) {
            // If the directory doesn't exist, create it
            fs.mkdirSync(outputDirectory, { recursive: true });
        }

        exec(`pandoc ${filePath} -f ${extension} -t markdown_strict -o ${outputFilePath} `, async (error) => {
            if (error) {
                console.log(error)
                return res.status(500).json({ error: 'Failed to convert file to markdown' });
            }


            const md = fs.readFileSync(outputFilePath, 'utf8');

            console.log("Converted to MD")
            const textbook = {
                // _id: new ObjectId(),
                md: md,
                name: name
            };
            const result = await db.collection('textbooks').insertOne(textbook);
            res.json(result);
        });

    } catch (error) {
        console.log(error);
    }
});

router.put('/update/:id', async (req, res) => {
    const db = await connectToDB();
    const id = req.params.id;
    const updates = req.body;
    const result = await db.collection('textbooks').updateOne({ _id: ObjectId(id) }, { $set: updates });
    res.json(result);
});

module.exports = router;