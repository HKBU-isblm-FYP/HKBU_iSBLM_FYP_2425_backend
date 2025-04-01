var express = require('express');
var router = express.Router();
const { connectToDB, ObjectId } = require('../utils/db');
const { createBlob, deleteBlob } = require('../utils/azure-blob');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

router.get('/all/:id', async function (req, res, next) {
    const studentid = req.params.id;
    let modules = [];
    const db = await connectToDB();
    try {
        modules = await db.collection('modules')
            .find({ student: new ObjectId(studentid) })
            // .project({ _id: 1, moduleName: 1, student: 1, sem: 1, courseCode: 1 })
            .toArray();
        modules.sort((a, b) => a.sem.localeCompare(b.sem));
        console.log(modules);
        return res.json(modules);
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
        for (let i = 0; i < module.presentations.components.length; i++) {
            const c = module.presentations.components[i];
            const comp = await db.collection('components').findOne({ _id: new ObjectId(c.id) });
            c.title = comp.title;
            console.log(c.title)
        }

        return res.json(module);
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});

router.post('/create/:id', async function (req, res, next) {
    const studentid = req.params.id;
    const db = await connectToDB();
    try {
        // Fetch the new collection's document to get templateIds
        const newCollection = await db.collection('adaptedTemp').findOne({}); // Replace 'newCollectionName' with the actual collection name
        const templateIds = newCollection.templateIds.map(id => new ObjectId(id));

        // Fetch the templates using templateIds
        const templates = await db.collection('moduleTemp').find({ _id: { $in: templateIds } }).toArray();

        // Insert the student ID into each template, remove the _id field, and remove the 'adapted' attribute
        const modulesWithStudentId = templates.map(template => {
            const { _id, adapted, ...templateWithoutIdAndAdapted } = template;
            return {
                ...templateWithoutIdAndAdapted,
                student: new ObjectId(studentid),
                meetingLogs: {
                    index: 2,
                    components: []
                },
                meetings: {
                    index: 1,
                    components: []
                }
            };
        });

        // Insert the modified templates into the 'modules' collection
        const insertResult = await db.collection('modules').insertMany(modulesWithStudentId);

        // Fetch the inserted documents to sort them
        const insertedModules = await db.collection('modules').find({ student: new ObjectId(studentid) }).toArray();
        insertedModules.sort((a, b) => a.sem.localeCompare(b.sem));

        res.json(insertedModules);
    } catch (err) {
        console.log(err);
        if (!res.headersSent) {
            return res.status(500).json({ error: err.toString() });
        }
    }
});

router.put('/meetings/delete/:id', async function (req, res, next) {
    const moduleid = req.params.id;
    const db = await connectToDB();
    try {
        const result = await db.collection('modules')
            .updateOne({ _id: new ObjectId(moduleid) }, { $set: { 'meetings.components': req.body.meetings } });
        return res.json(result);
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});


router.put('/meetings/add/:id', async function (req, res, next) {
    const moduleid = req.params.id;
    const newMeeting = req.body.newMeeting; // Assuming the new meeting object is in req.body.newMeeting
    newMeeting.date = new Date(newMeeting.date); // Convert the date string to a Date object
    newMeeting.meetingID = new ObjectId(); // Generate a new ObjectId for meetingID
    const db = await connectToDB();
    try {
        const result = await db.collection('modules')
            .updateOne(
                { _id: new ObjectId(moduleid) },
                { $push: { 'meetings.components': newMeeting } }
            );
        return res.json(result);
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});

router.put('/meetings/update/:id', async function (req, res, next) {
    const moduleid = req.params.id;
    const updatedMeetings = req.body.meetings;
    const db = await connectToDB();
    try {
        const result = await db.collection('modules')
            .updateOne(
                { _id: new ObjectId(moduleid) },
                { $set: { 'meetings.components': updatedMeetings } }
            );
        return res.json(result);
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});
router.put('/meetings/weekly/rate/:id', async function (req, res, next) {
    const moduleid = req.params.id;
    const meetingID = req.body.meetingID;
    const ratings = req.body.ratings;
    const db = await connectToDB();
    try {
        const result = await db.collection('modules')
            .updateOne(
                { _id: new ObjectId(moduleid), "meetings.components.meetingID": new ObjectId(meetingID) },
                { $set: { "meetings.components.$.ratings": ratings } }
            );
        return res.json(result);
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});

router.put('/meetingLogs/update/:id', async function (req, res, next) {
    const moduleid = req.params.id;
    const meetingLogs = req.body.meetingLogs; // Array of meeting logs
    const db = await connectToDB();
    try {
        const result = await db.collection('modules')
            .updateOne(
                { _id: new ObjectId(moduleid) },
                { $set: { 'meetingLogs.components': meetingLogs } }
            );
        return res.json(result);
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});

router.put('/meetingLogs/delete/:id', async function (req, res, next) {
    const moduleid = req.params.id;
    const meetingLogs = req.body.meetingLogs; // Updated array of meeting logs after deletion
    const db = await connectToDB();
    try {
        const result = await db.collection('modules')
            .updateOne(
                { _id: new ObjectId(moduleid) },
                { $set: { 'meetingLogs.components': meetingLogs } }
            );
        return res.json(result);
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});

router.get('/assignment/:id/:topicId/:assignmentId', async (req, res) => {
    const db = await connectToDB();
    try {
        const { id, topicId, assignmentId } = req.params;
        const module = await db.collection('modules').findOne(
            { _id: new ObjectId(id), 'topics.id': new ObjectId(topicId) },
            { projection: { 'topics.$': 1 } }
        );
        const assignment = module.topics[0].assignments.find(ass => ass.id.equals(new ObjectId(assignmentId)));
        console.log(assignment)
        if (assignment) {
            res.status(200).json(assignment);
        } else {
            res.status(404).json({ message: 'Assignment not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error fetching assignment', error });
    }
});

router.put('/assignment/:id/:topicId/:assignmentId/submit', async (req, res) => {
    const db = await connectToDB();
    const { id, topicId, assignmentId } = req.params;

    try {
        const assignmentSubmission = {
            submittedAt: new Date(),
            files: [],
            link: req.body.link || null,
        };

        // Fetch the existing assignment to delete old files
        const module = await db.collection('modules').findOne(
            { _id: new ObjectId(id), 'topics.id': new ObjectId(topicId) },
            { projection: { 'topics.$': 1 } }
        );

        const assignment = module.topics[0].assignments.find(ass => ass.id.equals(new ObjectId(assignmentId)));
        if (assignment && assignment.submission && assignment.submission.files) {
            for (const file of assignment.submission.files) {
                await deleteBlob(file.file.blobName);
            }
        }

        // Handle file uploads
        if (req.files && req.files.files) {
            const files = Array.isArray(req.files.files) ? req.files.files : [req.files.files];
            for (const file of files) {
                const blob = await createBlob(file.name, file.data);
                assignmentSubmission.files.push({
                    fileName: file.name,
                    file: blob,
                });
            }
        }

        // Update the assignment with the new submission
        const result = await db.collection('modules').updateOne(
            {
                _id: new ObjectId(id),
                'topics.id': new ObjectId(topicId),
                'topics.assignments.id': new ObjectId(assignmentId),
            },
            {
                $set: {
                    'topics.$.assignments.$[assignment].submission': assignmentSubmission,
                },
            },
            {
                arrayFilters: [{ 'assignment.id': new ObjectId(assignmentId) }],
            }
        );

        if (result.modifiedCount > 0) {
            res.status(200).json({ message: 'Submission uploaded successfully' });
        } else {
            res.status(404).json({ message: 'Assignment not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error submitting assignment', error });
    }
});


router.put('/:id/topics', async (req, res) => {
    const db = await connectToDB();
    try {
        const topic = req.body.topic;
        const module = await db.collection('modules').findOne({ _id: new ObjectId(req.params.id) });
        const index = module.topics ? module.topics.length : 0;
        await db.collection('modules').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $push: { topics: { id: new ObjectId(), topic: topic, index: index } } }
        );
        res.status(200).json({ topic });
    } catch (error) {
        res.status(500).json({ message: 'Error adding topic', error });
    }
});

router.patch('/:id/topics/:topicId', async (req, res) => {
    const db = await connectToDB();
    try {
        const { topic } = req.body;
        const { id, topicId } = req.params;
        await db.collection('modules').updateOne(
            { _id: new ObjectId(id), 'topics.id': new ObjectId(topicId) },
            { $set: { 'topics.$.topic': topic } }
        );
        res.status(200).json({ message: 'Topic updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating topic', error });
    }
});

router.delete('/:id/topics/:topicId', async (req, res) => {
    const db = await connectToDB();
    try {
        await db.collection('modules').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $pull: { topics: { id: new ObjectId(req.params.topicId) } } }
        );
        res.status(200).json({ message: 'Topic deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting topic', error });
    }
});
router.get('/:id/topics/:topicId/activity/:activityId', async (req, res) => {
    const db = await connectToDB();
    try {
        const module = await db.collection('modules').findOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { projection: { 'topics.$': 1 } }
        );
        const activity = module.topics[0].activities.find(act => act.id.equals(new ObjectId(req.params.activityId)));
        res.status(200).json(activity);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching activity', error });
    }
});

router.post('/:id/topics/:topicId/activity', async (req, res) => {
    const db = await connectToDB();
    try {
        const block = { ...req.body, id: new ObjectId(), Opened: new Date() };
        await db.collection('modules').updateOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { $push: { 'topics.$.activities': block } }
        );
        res.status(200).json({ block });
    } catch (error) {
        res.status(500).json({ message: 'Error adding activity', error });
    }
});

router.put('/:id/topics/:topicId/activity/:activityId', async (req, res) => {
    const db = await connectToDB();
    try {
        const { title, description, type, questions } = req.body;
        await db.collection('modules').updateOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId), 'topics.activities.id': new ObjectId(req.params.activityId) },
            { $set: { 'topics.$.activities.$[activity].title': title, 'topics.$.activities.$[activity].description': description, 'topics.$.activities.$[activity].type': type, 'topics.$.activities.$[activity].questions': questions } },
            { arrayFilters: [{ 'activity.id': new ObjectId(req.params.activityId) }] }
        );
        res.status(200).json({ message: 'Activity updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating activity', error });
    }
});


router.delete('/:id/topics/:topicId/activity/:activityId', async (req, res) => {
    const db = await connectToDB();
    try {
        await db.collection('modules').updateOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { $pull: { 'topics.$.activities': { id: new ObjectId(req.params.activityId) } } }
        );
        res.status(200).json({ message: 'Activity deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting activity', error });
    }
});

router.get('/:id/topics/:topicId/assignment/:assignmentId', async (req, res) => {
    const db = await connectToDB();
    try {
        const module = await db.collection('modules').findOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { projection: { 'topics.$': 1 } }
        );
        const assignment = module.topics[0].assignments.find(ass => ass.id.equals(new ObjectId(req.params.assignmentId)));
        res.status(200).json(assignment);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching assignment', error });
    }
});


router.post('/:id/topics/:topicId/assignment', async (req, res) => {
    const db = await connectToDB();
    try {
        let assignment = { ...req.body, id: new ObjectId(), files: [], Opened: new Date() };
        if (req.files && req.files.file) {
            const files = Array.isArray(req.files.file) ? req.files.file : [req.files.file];
            for (const file of files) {
                const blob = await createBlob(file.name, file.data);
                assignment.files.push({
                    fileName: file.name,
                    file: blob
                });
            }
        }
        await db.collection('modules').updateOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { $push: { 'topics.$.assignments': assignment } }
        );
        res.status(200).json({ assignment });
    } catch (error) {
        res.status(500).json({ message: 'Error adding assignment', error });
    }
});

router.put('/:id/topics/:topicId/assignment/:assignmentId', async (req, res) => {
    const db = await connectToDB();
    try {
        const { title, description, Due } = req.body;
        let files = [];

        if (req.body.fetchedFiles) {
            const fetchedFiles = JSON.parse(req.body.fetchedFiles);
            files = files.concat(fetchedFiles);
        }

        if (req.files && req.files.file) {
            const filesArray = Array.isArray(req.files.file) ? req.files.file : [req.files.file];
            for (const file of filesArray) {
                const blob = await createBlob(file.name, file.data);
                files.push({
                    file: blob,
                    fileName: file.name
                });
            }
        }

        await db.collection('modules').updateOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId), 'topics.assignments.id': new ObjectId(req.params.assignmentId) },
            { $set: { 'topics.$.assignments.$[assignment].title': title, 'topics.$.assignments.$[assignment].description': description, 'topics.$.assignments.$[assignment].Due': Due, 'topics.$.assignments.$[assignment].files': files } },
            { arrayFilters: [{ 'assignment.id': new ObjectId(req.params.assignmentId) }] }
        );
        res.status(200).json({ message: 'Assignment updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating assignment', error });
    }
});

router.delete('/:id/topics/:topicId/assignment/:assignmentId', async (req, res) => {
    const db = await connectToDB();
    try {
        const module = await db.collection('modules').findOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { projection: { 'topics.$': 1 } }
        );
        const assignment = module.topics[0].assignments.find(ass => ass.id.equals(new ObjectId(req.params.assignmentId)));
        if (assignment) {
            for (const file of assignment.files || []) {
                await deleteBlob(file.file.blobName);
            }
        }

        await db.collection('modules').updateOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { $pull: { 'topics.$.assignments': { id: new ObjectId(req.params.assignmentId) } } }
        );
        res.status(200).json({ message: 'Assignment deleted successfully' });
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: 'Error deleting assignment', error });
    }
});
router.get('/:id/topics/:topicId/resource/:resourceId', async (req, res) => {
    const db = await connectToDB();
    try {
        const module = await db.collection('modules').findOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { projection: { 'topics.$': 1 } }
        );
        const resource = module.topics[0].resources.find(res => res.id.equals(new ObjectId(req.params.resourceId)));
        res.status(200).json(resource);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching resource', error });
    }
});
router.post('/:id/topics/:topicId/resource', async (req, res) => {
    const db = await connectToDB();
    try {
        let resource = { ...req.body, id: new ObjectId(), files: [], Opened: new Date() };
        if (req.files && req.files.file) {
            const files = Array.isArray(req.files.file) ? req.files.file : [req.files.file];
            for (const file of files) {
                const blob = await createBlob(file.name, file.data);
                resource.files.push({
                    fileName: file.name,
                    file: blob
                });
            }
        }
        resource.submitTime = new Date();
        await db.collection('modules').updateOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { $push: { 'topics.$.resources': resource } }
        );
        res.status(200).json({ resource });
    } catch (error) {
        res.status(500).json({ message: 'Error adding resource', error });
    }
});

router.put('/:id/topics/:topicId/resource/:resourceId', async (req, res) => {
    const db = await connectToDB();
    try {
        const { title, description, link } = req.body;
        let files = [];

        if (req.body.fetchedFiles) {
            const fetchedFiles = JSON.parse(req.body.fetchedFiles);
            files = files.concat(fetchedFiles);
        }

        if (req.files && req.files.file) {
            const filesArray = Array.isArray(req.files.file) ? req.files.file : [req.files.file];
            for (const file of filesArray) {
                const blob = await createBlob(file.name, file.data);
                files.push({
                    file: blob,
                    fileName: file.name
                });
            }
        }

        await db.collection('modules').updateOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId), 'topics.resources.id': new ObjectId(req.params.resourceId) },
            { $set: { 'topics.$.resources.$[resource].title': title, 'topics.$.resources.$[resource].description': description, 'topics.$.resources.$[resource].link': link, 'topics.$.resources.$[resource].files': files, 'topics.$.resources.$[resource].submitTime': new Date() } },
            { arrayFilters: [{ 'resource.id': new ObjectId(req.params.resourceId) }] }
        );
        res.status(200).json({ message: 'Resource updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating resource', error });
    }
});

router.delete('/:id/topics/:topicId/resource/:resourceId', async (req, res) => {
    const db = await connectToDB();
    try {
        const module = await db.collection('modules').findOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { projection: { 'topics.$': 1 } }
        );
        const resource = module.topics[0].resources.find(res => res.id.equals(new ObjectId(req.params.resourceId)));
        if (resource) {
            for (const file of resource.files || []) {
                await deleteBlob(file.file.blobName);
            }
        }
        await db.collection('modules').updateOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { $pull: { 'topics.$.resources': { id: new ObjectId(req.params.resourceId) } } }
        );
        res.status(200).json({ message: 'Resource deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting resource', error });
    }
});

module.exports = router;