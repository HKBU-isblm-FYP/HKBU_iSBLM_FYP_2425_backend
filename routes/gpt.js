var express = require('express');
var router = express.Router();
const { connectToDB, ObjectId } = require('../utils/db');
const axios = require('axios');

router.get('/progress/:id', async function (req, res, next) {
    const moduleid = req.params.id;
    let module = {};
    const db = await connectToDB();
    try {
        module = await db.collection('modules')
            .findOne({ _id: new ObjectId(moduleid) });
        
        // Prepare the prompt message
        const promptMessage = {
            "messages": [
                {
                    "role": "user",
                    "content": `The following is the student's module data:\n\n${JSON.stringify(module, null, 2)}\n\nBased on this data, please evaluate the student's progress. Provide a evaluation of their performance, highlighting their strengths and areas for improvement. Include actionable feedback to help the student improve. Avoid mentioning exact scores but provide an overall percentage of progress. Note that meeting ratings are provided by the academic supervisor, and meeting records are contributed by either the student or the supervisor. If they has any submissions with gradings please also mention their performance in those submissions.`
                }
            ],
            "temperature": 0.3
        };

        // Send the prompt to the GPT API
        const response = await axios.post('https://genai.hkbu.edu.hk/general/rest/deployments/gpt-4-o/chat/completions?api-version=2024-05-01-preview', promptMessage, {
            headers: {
                'api-key': 'c79ccdbd-e51e-407e-90a8-58d2749e0887',
                'Content-Type': 'application/json'
            }
        });

        // Return only the content part of the GPT response
        const content = response.data.choices[0].message.content;
        res.json({ content: content });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: err.toString() });
    }
});

module.exports = router;