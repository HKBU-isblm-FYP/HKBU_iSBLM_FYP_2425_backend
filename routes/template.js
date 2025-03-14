var express = require('express');
var router = express.Router();
const { connectToDB, ObjectId } = require('../utils/db');
const { createBlob, deleteBlob } = require('../utils/azure-blob');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

router.get('/',async function (req, res, next) {
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

router.get('/:id',async function (req, res, next) {
    const db = await connectToDB();
    try{
        const template = await db.collection('moduleTemp').findOne({ _id: new ObjectId(req.params.id) });
        return res.json(template);
    }
    catch(err){
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
        const block = { ...req.body, id: new ObjectId() };
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
        let assignment = { ...req.body, id: new ObjectId() };
        if (req.files && req.files.file) {
            const blob = await createBlob(req.files.file.name, req.files.file.data);
            assignment.file = blob
        }
        await db.collection('moduleTemp').updateOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { $push: { 'topics.$.assignments': assignment } }
        );
        res.status(200).json({ assignment });
    } catch (error) {
        res.status(500).json({ message: 'Error adding assignment', error });
    }
});

router.post('/:id/topics/:topicId/resource', async (req, res) => {
    const db = await connectToDB();
    try {
        let resource = { ...req.body, id: new ObjectId(), files: [] };
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
        const { title, description, dueDate } = req.body;
        let file = req.body.file;
        
        if (req.files && req.files.file) {
            const blob = await createBlob(req.files.file.name, req.files.file.data);
            file = blob; // Correctly assign the blob to file
        }

        await db.collection('moduleTemp').updateOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId), 'topics.assignments.id': new ObjectId(req.params.assignmentId) },
            { $set: { 'topics.$.assignments.$[assignment].title': title, 'topics.$.assignments.$[assignment].description': description, 'topics.$.assignments.$[assignment].dueDate': dueDate, 'topics.$.assignments.$[assignment].file': file } },
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
        const module = await db.collection('moduleTemp').findOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { projection: { 'topics.$': 1 } }
        );
        const assignment = module.topics[0].assignments.find(ass => ass.id.equals(new ObjectId(req.params.assignmentId)));
        if (assignment && assignment.file) {
            const blobName = assignment.file.split('/').pop(); // Assuming the file URL ends with the blob name
            await deleteBlob(blobName);
        }
        await db.collection('moduleTemp').updateOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { $pull: { 'topics.$.assignments': { id: new ObjectId(req.params.assignmentId) } } }
        );
        res.status(200).json({ message: 'Assignment deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting assignment', error });
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

router.delete('/:id/topics/:topicId/resource/:resourceId', async (req, res) => {
    const db = await connectToDB();
    try {
        const module = await db.collection('moduleTemp').findOne(
            { _id: new ObjectId(req.params.id), 'topics.id': new ObjectId(req.params.topicId) },
            { projection: { 'topics.$': 1 } }
        );
        const resource = module.topics[0].resources.find(res => res.id.equals(new ObjectId(req.params.resourceId)));
        if (resource && resource.file) {
            const blobName = resource.file.split('/').pop(); // Assuming the file URL ends with the blob name
            await deleteBlob(blobName);
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

module.exports = router;