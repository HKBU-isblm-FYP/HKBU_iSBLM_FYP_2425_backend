var express = require('express');
var router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const { connectToDB } = require('../utils/db');
const fs = require('fs');
const path = require('path');

var years = '2023-2024';
var prefix = 'COMP4';

// const baseURL = `https://handbook.ar.hkbu.edu.hk/${years}/course/${prefix}`;
// const baseURL = 'https://handbook.ar.hkbu.edu.hk/2023-2024/course/COMP4';

router.get('/getCourses/:years/:prefix', async function (req, res, next) {
    const db = await connectToDB();
    console.log('Enter get Courses');
    const years = req.params.years;
    const courseCode = req.params.prefix;
    try {
        // const courses = await db.collection('courses').find({ courseCode: courseCode }).toArray();
        const courses = await db.collection('courses').find({
            courseCode: { $regex: `^${courseCode}`, $options: 'i' },
            years: years
        }).toArray();
        // console.log(courses);

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


/**
 * The Course just means it is connected to AR.. This is save to Lesson Collection
 */
router.get('/fetchCourses/:years/:prefix', async function (req, res, next) {
    const db = await connectToDB();

    const newlyAddedCourses = [];

    const years = req.params.years || '2023-2024';
    const prefix = req.params.prefix || 'COMP';

    const baseURL = `https://handbook.ar.hkbu.edu.hk/${years}/course/${prefix}`;

    try {
        const response = await axios.get(baseURL);
        const html = response.data;
        const $ = cheerio.load(html);

        const existingCourses = await db.collection('lessons').find({}).toArray();

        const coursePromises = $('.course-item').map(async (i, element) => {
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
                existingCourse.courseCode === course.courseCode &&
                existingCourse.title === course.title &&
                existingCourse.prerequisite === course.prerequisite &&
                existingCourse.description === course.description &&
                existingCourse.years === course.years
            );

            if (!courseExists) {
                console.log('adding', course);
                await db.collection('lessons').insertOne(course);
                newlyAddedCourses.push({ course });
            } else {
                await db.collection('lessons').updateOne({ title: course.title }, { $set: course });
            }
        });

        await Promise.all(coursePromises);

        console.log(newlyAddedCourses);

        res.json({ message: 'Courses fetched and stored in the database', newlyAddedCourses });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});

// File-based cache to track fetched years and course codes
const cacheFilePath = path.join(__dirname, '../cache/fetchCache.json');

// Load cache from file
let fetchCache = new Set();
if (fs.existsSync(cacheFilePath)) {
    try {
        const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf-8'));
        fetchCache = new Set(cacheData);
    } catch (err) {
        console.error('Error reading cache file:', err);
    }
}

// Save cache to file
function saveCacheToFile() {
    try {
        fs.writeFileSync(cacheFilePath, JSON.stringify([...fetchCache]), 'utf-8');
    } catch (err) {
        console.error('Error writing cache file:', err);
    }
}

router.get('/fetchAllCourses', async function (req, res, next) {
    const db = await connectToDB();

    const years = ["2020-2021", "2021-2022", "2022-2023", "2023-2024", "2024-2025"];
    const courseCodes = [
        'ACCT', 'AIDM', 'ARTD', 'ARTT', 'BAGE', 'BIOL', 'BMSC', 'BUSD', 'BUSI', 'CHEM', 'CHI', 'CHIL', 'CHSE', 'CHSG',
        'CMED', 'COMD', 'COMM', 'COMP', 'CTV', 'ECON', 'EDUC', 'EDUD', 'EDUM', 'ENG', 'ENGL', 'EPHM', 'EURO', 'FAGS',
        'FILM', 'FIN', 'FINE', 'FREN', 'GAME', 'GCAP', 'GCHC', 'GCIT', 'GCNU', 'GCPE', 'GCPS', 'GCST', 'GCVM', 'GDAR',
        'GDBU', 'GDCV', 'GDSC', 'GDSS', 'GEND', 'GEOG', 'GERM', 'GEST', 'GFHC', 'GFQR', 'GFVM', 'GTCU', 'GTSC', 'GTSU',
        'HIST', 'HRM', 'HRMN', 'HSWB', 'HUM', 'HUMN', 'ISEM', 'ITAL', 'ITEC', 'ITS', 'JOUR', 'JPSE', 'LANG', 'LLAW',
        'LSE', 'MATH', 'MCCP', 'MCM', 'MDD', 'MFFM', 'MGNT', 'MHM', 'MKT', 'MKTG', 'MPS', 'MUCS', 'MUS', 'MUSI', 'ORBS',
        'PE', 'PCMD', 'PEDU', 'PERM', 'PHYS', 'POLS', 'PRAO', 'PSYC', 'REL', 'RELI', 'REMT', 'RPG', 'SCI', 'SCIB',
        'SCIE', 'SCIP', 'SCM', 'SLM', 'SOC', 'SOCI', 'SOSC', 'SOWK', 'SPAN', 'SPEH', 'TRA', 'TRAN', 'UCHL', 'UCLC',
        'UCPN', 'ULIF', 'VACC', 'VACD', 'VART', 'VASA', 'WRIT'
    ];

    const newlyAddedCourses = [];

    try {
        for (const year of years) {
            for (const prefix of courseCodes) {
                const cacheKey = `${year}-${prefix}`;
                if (fetchCache.has(cacheKey)) {
                    console.log(`Skipping already fetched: ${cacheKey}`);
                    continue;
                }

                const baseURL = `https://handbook.ar.hkbu.edu.hk/${year}/course/${prefix}`;
                console.log(`Fetching courses from ${baseURL}`);

                try {
                    const response = await axios.get(baseURL);
                    const html = response.data;
                    const $ = cheerio.load(html);

                    const existingCourses = await db.collection('lessons').find({}).toArray();

                    const coursePromises = $('.course-item').map(async (i, element) => {
                        const title = $(element).find('h5').text().trim();
                        const prerequisite = $(element).find('dd').text().trim();
                        const description = $(element).find('.detail p').text().trim();
                        const courseCode = title.match(/^([A-Z]{4}\d{4})/) ? title.match(/^([A-Z]{4}\d{4})/)[0] : null;

                        let units = title.match(/\((\d+) units\)$/) ? Number(title.match(/\((\d+) units\)$/)[1]) : null;
                        if (units === null) {
                            units = title.match(/\((\d+) unit\)$/) ? Number(title.match(/\((\d+) unit\)$/)[1]) : null;
                        }

                        const course = {
                            courseCode,
                            title,
                            prerequisite,
                            description,
                            years: year,
                            units,
                            creationDate: new Date(),
                            md: `
# Course Code: ${courseCode}

**Years:** ${year}

**Units:** ${units}

## Title: ${title}

**Prerequisite:** 
\`\`\`
${prerequisite}
\`\`\`

### Description

${description}
`
                        };

                        const courseExists = existingCourses.some(existingCourse =>
                            existingCourse.courseCode === course.courseCode &&
                            existingCourse.title === course.title &&
                            existingCourse.prerequisite === course.prerequisite &&
                            existingCourse.description === course.description &&
                            existingCourse.years === course.years
                        );

                        if (!courseExists) {
                            console.log('Adding new course:', course);
                            await db.collection('lessons').insertOne(course);
                            newlyAddedCourses.push(course);
                        } else {
                            await db.collection('lessons').updateOne({ title: course.title }, { $set: course });
                        }
                    });

                    await Promise.all(coursePromises);

                    // Mark this year and prefix as fetched
                    fetchCache.add(cacheKey);
                    saveCacheToFile();
                } catch (fetchError) {
                    console.error(`Error fetching ${cacheKey}:`, fetchError);
                }
            }
        }

        res.json({ message: 'All courses fetched and stored in the database', newlyAddedCourses });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.toString() });
    }
});

router.get('/cleanCourseCode', async function (req, res, next) {
    const db = await connectToDB();

    try {
        const lessons = await db.collection('lessons').find({ courseCode: null }).toArray();

        const updatePromises = lessons.map(async (lesson) => {
            const titleParts = lesson.title.split(' ');
            const courseCode = titleParts.slice(0, 2).join('');

            await db.collection('lessons').updateOne(
                { _id: lesson._id },
                { $set: { courseCode } }
            );

            console.log(`Updated courseCode for lesson with _id: ${lesson._id} to ${courseCode}`);
        });

        await Promise.all(updatePromises);

        const lessons1 = await db.collection('lessons').find({ courseCode: { $regex: /\s/ } }).toArray();
        const updatePromises1 = lessons1.map(async (lesson) => {
            const courseCode = lesson.courseCode.replace(/\s+/g, '');

            await db.collection('lessons').updateOne(
                { _id: lesson._id },
                { $set: { courseCode } }
            );

            console.log(`Updated courseCode for lesson with _id: ${lesson._id} to ${courseCode}`);
        });

        await Promise.all(updatePromises1);

        res.json({ message: 'All null courseCodes have been updated' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.toString() });
    }
});

module.exports = router;
