var express = require('express');
var router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const { connectToDB } = require('../utils/db');

const baseURL = 'https://handbook.ar.hkbu.edu.hk/2023-2024/course/COMP4';

router.get('/fetchCourses', async function (req, res, next) {
    const db = await connectToDB();

    try {
        const response = await axios.get(baseURL);
        const html = response.data;
        const $ = cheerio.load(html);

        $('.course-item').each((i, element) => {
            const title = $(element).find('h5').text().trim();
            const prerequisite = $(element).find('dd').text().trim();
            const description = $(element).find('.detail p').text().trim();

            const course = {
                title,
                prerequisite,
                description
            };

            db.collection('courses').insertOne(course);
        });

        res.json({ message: 'Courses fetched and stored in the database' });

    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});

module.exports = router;
