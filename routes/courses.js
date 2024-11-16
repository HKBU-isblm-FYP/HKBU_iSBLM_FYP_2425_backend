var express = require('express');
var router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const { connectToDB } = require('../utils/db');

var years = '2023-2024';
var prefix = 'COMP4';

// const baseURL = `https://handbook.ar.hkbu.edu.hk/${years}/course/${prefix}`;
// const baseURL = 'https://handbook.ar.hkbu.edu.hk/2023-2024/course/COMP4';

router.get('/getCourses/:courseCode', async function (req, res, next) {
    const db = await connectToDB();
    console.log('Enter get Courses');
    const courseCode = req.params.courseCode;
    try {
        // const courses = await db.collection('courses').find({ courseCode: courseCode }).toArray();
        const courses = await db.collection('courses').find({ courseCode: { $regex: `^${courseCode}` } }).toArray();
        if (courses.length > 0) {
            res.json({ courses: courses });
        } else {
            res.status(404).json({ message: 'No courses found with that code' });
        }
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});


router.get('/fetchCourses/:years/:prefix', async function (req, res, next) {

    const db = await connectToDB();

    var globalCourse = [];

    const years = req.params.years || '2023-2024';
    const prefix = req.params.prefix || 'COMP';

    const baseURL = `https://handbook.ar.hkbu.edu.hk/${years}/course/${prefix}`;

    try {
        const response = await axios.get(baseURL);
        const html = response.data;
        const $ = cheerio.load(html);

        const existingCourses = await db.collection('courses').find({}).toArray();

        $('.course-item').each((i, element) => {
            const title = $(element).find('h5').text().trim();
            const prerequisite = $(element).find('dd').text().trim();
            const description = $(element).find('.detail p').text().trim();
            // const courseCode = title.match(/^([A-Z]{4}\d{4})/); // This will match a pattern like COMP4005
            const courseCode = title.match(/^([A-Z]{4}\d{4})/) ? title.match(/^([A-Z]{4}\d{4})/)[0] : null;

            //Handle units / unit storing to DB.
            let units = title.match(/\((\d+) units\)$/) ? Number(title.match(/\((\d+) units\)$/)[1]) : null;
            if (units === null) {
                units = title.match(/\((\d+) unit\)$/) ? Number(title.match(/\((\d+) unit\)$/)[1]) : null;
            }
            // const units = title.match(/\((\d+) unit\(s\)\)$/) ? Number(title.match(/\((\d+) unit\(s\)\)$/)[1]) : null;

            const course = {
                courseCode,
                title,
                prerequisite,
                description,
                years: years,
                units,
                creationDate: new Date(),
            };

            // Check if the course already exists in the database
            const courseExists = existingCourses.some(existingCourse =>
                existingCourse.title === course.title &&
                existingCourse.prerequisite === course.prerequisite &&
                existingCourse.description === course.description &&
                existingCourse.years === course.years
            );

            if (!courseExists) {
                console.log(course);

                db.collection('courses').insertOne(course);
                globalCourse.push(course);
            } else {
                db.collection('courses').updateOne({ title: course.title }, { $set: course });
            }

        });

        res.json({ message: 'Courses fetched and stored in the database', course: globalCourse });

    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});

module.exports = router;
