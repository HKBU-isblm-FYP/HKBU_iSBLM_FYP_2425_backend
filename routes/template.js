var express = require('express');
var router = express.Router();
const { connectToDB, ObjectId } = require('../utils/db');
const { createBlob, deleteBlob } = require('../utils/azure-blob');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

router.get('/', async function (req, res, next) {
    const db = await connectToDB();
    try {
        const template = await db.collection('moduleTemp').find().toArray();

        return res.json(template);
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});

router.post('/create', async function (req, res, next) {
    const db = await connectToDB();
    try {
        const template = req.body;
        if (template.blueprintTitle) { // Use blueprintTitle instead of blueprintYearPlan
            const existingTemplate = await db.collection('moduleTemp').find({ title: template.blueprintTitle }).toArray(); // Query by title
            if (existingTemplate.length > 0) {
                const currentTemplate = await db.collection('moduleTemp').find({ title: template.title }).toArray();
                if (currentTemplate.length > 0) {
                    await db.collection('moduleTemp').deleteMany({ yearPlan: template.yearPlan });
                }
                existingTemplate.forEach(module => {
                    module.yearPlan = template.yearPlan.toString();
                    module.title = template.title; // Update title for the new template
                    delete module._id; // Remove the existing _id to allow MongoDB to generate a new one
                });
                for (const module of existingTemplate) {
                    await db.collection('moduleTemp').insertOne(module);
                }
            }
        } else {
            const currentTemplate = await db.collection('moduleTemp').find({ yearPlan: template.yearPlan }).toArray();
            if (currentTemplate.length > 0) {
                await db.collection('moduleTemp').deleteMany({ yearPlan: template.yearPlan });
            }
            const details = req.body.details;
            const yearPlan = template.yearPlan.toString();
            const modules = [];

            for (const [key, moduleName] of Object.entries(details)) {
                if (moduleName) {
                    const sem = key.replace('sem', '');
                    modules.push({
                        moduleName: moduleName,
                        sem: sem,
                        yearPlan: yearPlan,
                        title: template.title // Add title to each module
                    });
                }
            }

            if (modules.length > 0) {
                await db.collection('moduleTemp').insertMany(modules);
            }
        }
        return res.status(200).json({ message: 'Template created successfully' });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});

router.post('/adapt', async function (req, res, next) {
    const db = await connectToDB();
    try {
        // Find the template to adapt
        const template = await db.collection('moduleTemp').find({ title: req.body.title }).toArray();
        if (template.length === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // Update the adapted attribute in the original template
        await db.collection('moduleTemp').updateMany(
            { title: req.body.title },
            { $set: { adapted: true } }
        );

        // Ensure only one document exists in the adaptedTemp collection
        const adaptedEntry = {
            adapt: true,
            title: req.body.title,
            yearPlan: req.body.yearPlan,
            templateIds: template.map(module => module._id)
        };
        await db.collection('adaptedTemp').replaceOne({}, adaptedEntry, { upsert: true });

        return res.status(200).json({ message: 'Template adapted successfully', adaptedEntry });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});

router.delete('/delete', async function (req, res, next) {
    const db = await connectToDB();
    try {
        const title = req.query.title; // Get title from query parameter
        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        // Find and delete the template
        const template = await db.collection('moduleTemp').find({ title }).toArray();
        if (template.length === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }
        await db.collection('moduleTemp').deleteMany({ title });

        // Remove associated entry from adaptedTemp
        await db.collection('adaptedTemp').deleteMany({
            templateIds: { $in: template.map(module => module._id) }
        });

        return res.status(200).json({ message: 'Template deleted successfully' });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});
router.get('/adapted', async function (req, res, next) {
    const db = await connectToDB();
    try {
        const adapted = await db.collection('adaptedTemp').findOne({});
        return res.json(adapted || {});
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});

router.get('/:id', async function (req, res, next) {
    const db = await connectToDB();
    try {
        const template = await db.collection('moduleTemp').findOne({ _id: new ObjectId(req.params.id) });
        return res.json(template);
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});

router.put('/:id/topics', async (req, res) => {
    const db = await connectToDB();
    try {
        const topic = req.body.topic;
        const module = await db.collection('moduleTemp').findOne({ _id: new ObjectId(req.params.id) });
        const index = module.topics ? module.topics.length : 0;
        await db.collection('moduleTemp').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $push: { topics: { id: new ObjectId(), topic: topic, index: index } } }
        );
        res.status(200).json({ topic });
    } catch (error) {
        res.status(500).json({ message: 'Error updating topics', error });
    }
});

router.patch('/:id/topics/:topicId', async (req, res) => {
    const db = await connectToDB();
    try {
        const { topic } = req.body;
        const { id, topicId } = req.params;
        await db.collection('moduleTemp').updateOne(
            { _id: new ObjectId(id), 'topics.id': new ObjectId(topicId) },
            { $set: { 'topics.$.topic': topic } }
        );
        res.status(200).json({ message: 'Topic updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating topic', error });
    }
});

router.post('/:id/topics/:topicId/activity', async (req, res) => {
    const db = await connectToDB();
    try {
        const block = { ...req.body, id: new ObjectId(), Opened: new Date() };
        await db.collection('moduleTemp').updateOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { $push: { 'topics.$.activities': block } }
        );
        res.status(200).json({ block });
    } catch (error) {
        res.status(500).json({ message: 'Error adding block', error });
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
        await db.collection('moduleTemp').updateOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { $push: { 'topics.$.assignments': assignment } }
        );

        // Create a notice for the assignment
        const notice = {
            due: new Date(req.body.Due),
            type: 'assignment',
            bid: {
                templateID: new ObjectId(req.params.id),
                topicID: new ObjectId(req.params.topicId),
                assignmentID: assignment.id
            },
            overdue: false
        };
        await db.collection('notices').insertOne(notice);

        res.status(200).json({ assignment });
    } catch (error) {
        res.status(500).json({ message: 'Error adding assignment', error });
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
        await db.collection('moduleTemp').updateOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { $push: { 'topics.$.resources': resource } }
        );
        res.status(200).json({ resource });
    } catch (error) {
        res.status(500).json({ message: 'Error adding resource', error });
    }
});

router.get('/:id/topics/:topicId/activity/:activityId', async (req, res) => {
    const db = await connectToDB();
    try {
        const module = await db.collection('moduleTemp').findOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { projection: { 'topics.$': 1 } }
        );
        const activity = module.topics[0].activities.find(act => act.id.equals(new ObjectId(req.params.activityId)));
        res.status(200).json(activity);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching activity', error });
    }
});

router.put('/:id/topics/:topicId/activity/:activityId', async (req, res) => {
    const db = await connectToDB();
    try {
        const { title, description, type, questions } = req.body;
        await db.collection('moduleTemp').updateOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId), 'topics.activities.id': new ObjectId(req.params.activityId) },
            { $set: { 'topics.$.activities.$[activity].title': title, 'topics.$.activities.$[activity].description': description, 'topics.$.activities.$[activity].type': type, 'topics.$.activities.$[activity].questions': questions } },
            { arrayFilters: [{ 'activity.id': new ObjectId(req.params.activityId) }] }
        );
        res.status(200).json({ message: 'Activity updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating activity', error });
    }
});

router.get('/:id/topics/:topicId/assignment/:assignmentId', async (req, res) => {
    const db = await connectToDB();
    try {
        const module = await db.collection('moduleTemp').findOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { projection: { 'topics.$': 1 } }
        );
        const assignment = module.topics[0].assignments.find(ass => ass.id.equals(new ObjectId(req.params.assignmentId)));
        res.status(200).json(assignment);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching assignment', error });
    }
});

router.put('/:id/topics/:topicId/assignment/:assignmentId', async (req, res) => {
    const db = await connectToDB();
    try {
        const { title, description, Due } = req.body;
        let files = [];

        // Add fetched files to the files array
        if (req.body.fetchedFiles) {
            const fetchedFiles = JSON.parse(req.body.fetchedFiles);
            files = files.concat(fetchedFiles);
        }

        // Add new files to the files array
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

        // Update the assignment
        await db.collection('moduleTemp').updateOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId), 'topics.assignments.id': new ObjectId(req.params.assignmentId) },
            { $set: { 'topics.$.assignments.$[assignment].title': title, 'topics.$.assignments.$[assignment].description': description, 'topics.$.assignments.$[assignment].Due': Due, 'topics.$.assignments.$[assignment].files': files } },
            { arrayFilters: [{ 'assignment.id': new ObjectId(req.params.assignmentId) }] }
        );

        // Update the corresponding notice
        await db.collection('notices').updateOne(
            { 'bid.assignmentID': new ObjectId(req.params.assignmentId) },
            { $set: { due: new Date(Due) } }
        );

        res.status(200).json({ message: 'Assignment updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating assignment', error });
    }
});

router.delete('/:id/topics/:topicId/activity/:activityId', async (req, res) => {
    const db = await connectToDB();
    try {
        await db.collection('moduleTemp').updateOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { $pull: { 'topics.$.activities': { id: new ObjectId(req.params.activityId) } } }
        );
        res.status(200).json({ message: 'Activity deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting activity', error });
    }
});

router.delete('/:id/topics/:topicId', async (req, res) => {
    const db = await connectToDB();
    try {
        const module = await db.collection('moduleTemp').findOne(
            { _id: new ObjectId(req.params.id) },
            { projection: { topics: 1 } }
        );
        const topic = module.topics.find(t => t.id.equals(new ObjectId(req.params.topicId)));

        if (topic) {
            // Delete associated files for resources
            for (const resource of topic.resources || []) {
                for (const file of resource.files || []) {
                    await deleteBlob(file.file.blobName);
                }
            }

            // Delete associated files for assignments
            for (const assignment of topic.assignments || []) {
                for (const file of assignment.files || []) {
                    await deleteBlob(file.file.blobName);
                }
            }
        }

        await db.collection('moduleTemp').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $pull: { topics: { id: new ObjectId(req.params.topicId) } } }
        );
        res.status(200).json({ message: 'Topic deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting topic', error });
    }
});

router.delete('/:id/topics/:topicId/assignment/:assignmentId', async (req, res) => {
    const db = await connectToDB();
    try {
        const module = await db.collection('moduleTemp').findOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { projection: { 'topics.$': 1 } }
        );
        const assignment = module.topics[0].assignments.find(ass => ass.id.equals(new ObjectId(req.params.assignmentId)));
        if (assignment) {
            for (const file of assignment.files || []) {
                await deleteBlob(file.file.blobName);
            }
        }

        // Delete the assignment
        await db.collection('moduleTemp').updateOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { $pull: { 'topics.$.assignments': { id: new ObjectId(req.params.assignmentId) } } }
        );

        // Delete the corresponding notice
        await db.collection('notices').deleteOne({ 'bid.assignmentID': new ObjectId(req.params.assignmentId) });

        res.status(200).json({ message: 'Assignment deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting assignment', error });
    }
});

router.delete('/:id/topics/:topicId/resource/:resourceId', async (req, res) => {
    const db = await connectToDB();
    try {
        const module = await db.collection('moduleTemp').findOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { projection: { 'topics.$': 1 } }
        );
        const resource = module.topics[0].resources.find(res => res.id.equals(new ObjectId(req.params.resourceId)));
        if (resource) {
            for (const file of resource.files || []) {
                await deleteBlob(file.file.blobName);
            }
        }
        await db.collection('moduleTemp').updateOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { $pull: { 'topics.$.resources': { id: new ObjectId(req.params.resourceId) } } }
        );
        res.status(200).json({ message: 'Resource deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting resource', error });
    }
});

router.get('/:id/topics/:topicId/resource/:resourceId', async (req, res) => {
    const db = await connectToDB();
    try {
        const module = await db.collection('moduleTemp').findOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { projection: { 'topics.$': 1 } }
        );
        const resource = module.topics[0].resources.find(res => res.id.equals(new ObjectId(req.params.resourceId)));
        res.status(200).json(resource);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching resource', error });
    }
});

router.put('/:id/topics/:topicId/resource/:resourceId', async (req, res) => {
    const db = await connectToDB();
    try {
        const { title, description, link } = req.body;
        let files = [];

        // Add fetched files to the files array
        if (req.body.fetchedFiles) {
            const fetchedFiles = JSON.parse(req.body.fetchedFiles);
            files = files.concat(fetchedFiles);
        }

        // Add new files to the files array
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

        await db.collection('moduleTemp').updateOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId), 'topics.resources.id': new ObjectId(req.params.resourceId) },
            { $set: { 'topics.$.resources.$[resource].title': title, 'topics.$.resources.$[resource].description': description, 'topics.$.resources.$[resource].link': link, 'topics.$.resources.$[resource].files': files, 'topics.$.resources.$[resource].submitTime': new Date() } },
            { arrayFilters: [{ 'resource.id': new ObjectId(req.params.resourceId) }] }
        );
        res.status(200).json({ message: 'Resource updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating resource', error });
    }
});
router.put('/moduleName/:id', async (req, res) => {
    const db = await connectToDB();
    try {
        await db.collection('moduleTemp').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { moduleName: req.body.moduleName } }
        );
        res.status(200).json({ message: 'Module title updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating module title', error });
    }
});
module.exports = router;