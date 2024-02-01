/**
 * Author: Chan Hok Ting
 * 
 * GCAP3055/56 App
 * 
 * Utilize POP3 to Download Email and Sync to MongoDB
 */

var express = require('express');
var router = express.Router();

const { connectToDB, ObjectId } = require('../utils/db');
const { saveToBlackBlaze, getPrivateDownloadUrl, B2 } = require('../utils/backblaze')

const fs = require('fs');
const { simpleParser, MailParser } = require('mailparser');
const PopNode = require('node-pop3');
const { SourceTextModule } = require('vm');

const ARCHIVE = 'rawEmailList.json';
// Initialize email object with connection info.
const pop3Outlook = {
    user: 'gcap3056@outlook.com',
    password: 'hkbugcap3055',
    host: 'outlook.office365.com',
    port: 995,
    tls: true
};
const pop3 = new PopNode(pop3Outlook);

//Global Variable of ID and UID Email Apps
let emailIDList = null;
let mapUIDToID = new Map(); //Server HashMap for mapping UID to ID;
let mapIDToUID = new Map(); //Server HashMap for mapping ID to UID


let localMapUIDToID = new Map(); //Local HashMap for mapping UID to ID;
let localMapIDToUID = new Map(); //Local HashMap for mapping ID to UID

let localParsedList = null; //Store Global pharse mail List in CheckSync func

let hasInit = false;


let MAX;
// let MAX = emailIDList.length; //For Limit the num, Test purpose;
// let MAX = 5; //For Limit the num, Test purpose;

let parser = new MailParser({ //Option for Parser.
    skipHtmlToText: true,
});

async function initList() {

    if (hasInit) {
        return;
    }

    emailIDList = await pop3.UIDL(); //Return an [[i, j]...] Array of Object. (I is the natural Index, j is the UID of mail)
    createMaps(emailIDList, mapUIDToID, mapIDToUID);

    MAX = emailIDList.length;

    hasInit = true;

    pop3.QUIT();
}



/**
 * 
 * To Skip the effort of redownloading everything -> Purpose of This Function
 * Procedures: Check the UID of Local Storage object comapare to Server's Mails UID.
 * 
 * @param {localRawMailStoragte} backup 
 * @param {ServerIDListFresh} emailIDList 
 * @returns 
 */
async function checkSync(backup, emailIDList) {

    console.log("Enter CheckAndSync")

    localParsedList = await praseMailList(backup, emailIDList); //I shall also Store the Local UID in Here.

    //Problem 1 -> How to Get the UID of Local. - Solved by Injecting UID!
    // parsedBak.forEach(x => console.log(x.UID));

    //Get a list of missing mails -> Redownload them
    let sameUIDList = [];
    let sameIndexList = [];

    for (let i = 0; i < emailIDList.length; i++) {
        let sUid = emailIDList[i][1];

        for (let j = 0; j < localParsedList.length; j++) {
            let pUid = localParsedList[j].UID;

            if (sUid === pUid) {
                sameUIDList.push(sUid); //Respecting the Order of LocalParsedList.

                break;
            }
        }
    }

    sameIndexList = sameUIDList.map(x => getIndex(x));

    // create Local Maps
    for (let i = 0; i < sameIndexList.length; i++) {
        localMapIDToUID.set(sameIndexList[i], sameUIDList[i]);
        localMapUIDToID.set(sameUIDList[i], sameIndexList[i]);
    }

    console.log("These are same email UID list: " + sameUIDList);
    console.log("These are same email index list: " + sameIndexList);

    let ogUIDs = emailIDList.map(pair => pair[1]);
    let missingUIDList = ogUIDs.filter(id => !sameUIDList.includes(id));
    let missingIndexList = missingUIDList.map(x => getIndex(x));

    console.log("These are the missing UID list: \n" + missingUIDList);
    console.log("These are the missing email index list: \n" + missingIndexList);
    console.log(typeof missingIndexList[0]);

    if (missingUIDList.length > 0) {
        console.log("Not Sync")
        return false, missingIndexList //We have to Download the missing
    }

    return true // We are synced.
}

//Get Index of Mail from UID
function getIndex(uid) {
    // let i = mapUIDToID[uid];
    let i = mapUIDToID.get(uid);
    // let j = hashmapUID.get(uid); //It was stored with[], so .get() would not work.
    // console.log('getIndex i' + i + ' ' + j);
    return i;
}

//Download All the Mails to Local
async function downloadMails(pop3, MAX) {

    console.log("Downloading Mails");
    let emailsList = [];

    // for (let i = 0; i < emailIDList.length; i++) {
    for (let i = 0; i < MAX; i++) {
        const mail = await pop3.RETR(i + 1, 0);
        emailsList.push(mail);
        console.log("Getting Email No." + (i + 1));
    }

    return emailsList;
}

//Download Emails That missed in Local from POP3 Server
async function downloadMissingMails(pop3, MAX, backup, missingIndexList) {

    console.log("Downloading Mails");
    let emailsList = backup;

    let cSize = backup.length;

    // for (let i = 0; i < emailIDList.length; i++) {
    for (let i = 0; i < MAX - cSize; i++) {
        let j = missingIndexList[i];
        // console.log(typeof j)
        const mail = await pop3.RETR(j, 0);
        emailsList.push(mail);
        // console.log("Getting Email Index No." + j);
        console.log("Getting Email Index No." + (j + 1));
    }

    return emailsList;
}

//Use File Stream to Save Mails
async function saveEmails(emailsList) {

    //Save Emails To Local
    const data = emailsList.join('\\n');
    fs.writeFile(ARCHIVE, data, function (err) {
        if (err) {
            console.error('Error occurred:', err);
        } else {
            console.log('Email array saved successfully!');
        }
    });

}

//Get All Emails from the InBox / Sync if needed
async function getMailList(pop3, emailIDList) {

    const localMails = await getArchive(); //Get Local Email Storage

    let emailsList = [];

    // PLACEHOLDER - Late Need to Sync according to Item ID
    if (localMails.length > 0) { //If Local Emails exists

        console.log("Loaded backup")
        console.log("Checking Sync Status")

        let isSync, missingIndexList = await checkSync(localMails, emailIDList);

        if (isSync) {
            return localMails;
        }

        //Need to download Back the Missing Parts.
        // if (localMails.length == MAX) {
        //     return localMails;

        console.log(missingIndexList);
        console.log("Back At GetMailList");

        emailsList = await downloadMissingMails(pop3, MAX, localMails, missingIndexList);

        // emailsList = localMails;
    } else {

        emailsList = await downloadMails(pop3, MAX);
    }

    await saveEmails(emailsList);

    return emailsList;
}

/**
 * 
//Phrase the List of email with attributes for access -> also add the UID attributes to the object.
 * @param {ListOfRawMails} emailsList 
 * @param {ListOfIDs} emailIDList 
 * @returns 
 */
async function praseMailList(emailsList, emailIDList) {

    console.log('Parsing List')
    // console.log(emailsList[9]);
    // console.log(emailsList.length);

    let parsedList = [];

    for (let i = 0; i < emailsList.length; i++) {
        // parsedList.push(await simpleParser(emailsList[i]));
        let parsed = await simpleParser(emailsList[i]);
        //Inject UID attribute to parsed Mail
        // console.log(emailIDList);
        parsed.UID = emailIDList[i][1];
        // console.log("Marked:" + parsed.UID);
        if (!parsed) {
            console.log('Error');
        } else {
            parsedList.push(parsed);
        }

    }

    // console.log(parsedList[0]);
    // console.log("subject")
    // console.log(parsedList[0].subject);
    // console.log("Exit parsing")

    return parsedList;
}

/**
 * 
 * Make map from UID to Index  / OR ID to UID/ of Inbox mails list
 * @param {ListofID} emailIDList 
 * @param {Map} UIDToID 
 * @param {Map} IDToUID 
 */
async function createMaps(emailIDList, UIDToID, IDToUID) {

    //Map UID to index number of Mail.
    emailIDList.forEach(pair => {
        let index = pair[0];
        let uid = pair[1];
        // mapUIDToID[uid] = index;
        // mapIDToUID[index] = uid;


        UIDToID.set(uid, index); //Need to use Set for has() map features
        IDToUID.set(index, uid);
    })

}


function hasAttachment(parsedEmail) {

    if (parsedEmail.headers.get('x-ms-has-attach') && parsedEmail.headers.get('x-ms-has-attach').toLowerCase() === 'yes') {

        console.log("Has attachemnts");
        return true;
    }

    console.log("Has no attachemnts");
    return false;
}


router.get('/emails', async (req, res) => {

    await initList();
    // Fetch list of all emails
    // let emailsList = await pop3.UIDL();
    // console.log(emailsList);

    // Fetch the email content
    let msg = await pop3.RETR(emailIDList[1][0]);

    await pop3.QUIT();

    // Parse the email content
    let parsedEmail = await simpleParser(msg);

    res.json(parsedEmail);
});

async function getArchive() {

    // const backup = localStorage.getItem(ARCHIVE);
    console.log("Loading backup")

    try {
        const data = await fs.promises.readFile(ARCHIVE, 'utf8');
        const array = data.split('\\n');
        return array;
    } catch (err) {
        return 0;
    }

}


// GET an EmailList from MailBox
router.get('/list-local', async (req, res) => {

    // Fetch list of all emails
    await initList();

    let emailsList = await getMailList(pop3, emailIDList);

    await pop3.QUIT();
    
    localParsedList = await praseMailList(emailsList, emailIDList); //Need to resolve promise
    // console.log('List Len:' + emailsList.length);

    let emailNameList = [];

    for (let i = 0; i < localParsedList.length; i++) {
        // console.log('In Da Loop'append)

        let parsed =localParsedList[i];

        let obj = {
         subject : parsed.subject,
         from : parsed.headers.get('from'),
         to : parsed.headers.get('to'),
        }

        // console.log(localParsedList[i]);
        // console.log(subject);
        emailNameList.push(obj);
    }

    // console.log(emailIDList);
    // console.log(localParsedList[0]);

    res.json({ list: emailNameList, Count: emailIDList.length, Limit: MAX }); // I have yet to figure This Thang out.
});


//Get an Email
router.get('/email/:num', async (req, res) => {

    await initList();

    let num = validNum(req.params.num);

    const localMails = await getArchive(); //Get Local Email Storage
    await checkSync(localMails, emailIDList); //This Part shall have a Global Parsed List of Mails.

    let parsedEmail = null;

    let query = num.toString();
    if (localMapIDToUID.has(query)) {

        console.log("Get From Local");
        parsedEmail = localParsedList[getListIndex(num)];
    } else {

        console.log('Getting Server Email No.' + num);
        const rawEmail = await pop3.RETR(num);
        await pop3.QUIT();
        parsedEmail = await simpleParser(rawEmail);
    }

    result = {
        subject: parsedEmail.headers.get("subject"),
        from: parsedEmail.headers.get('from'),
        // attachment: prasedEmail.attachment,
        hasAttachment: hasAttachment(parsedEmail),
    }

    parsedEmail.hasAttachment = hasAttachment;

    return res.json(parsedEmail);
});

/**
 * 
 * Check params num - run after init
 * 
 * @param {int} num 
 * @returns num 
 */
function validNum(num) {

    if (num < 1 || num > emailIDList.length - 1) { //This num of email is Invalid
        console.log("Reset Invalid num");
        num = 1;
    }

    return num;
}

/**
 * Index trans from Natural to 0 based | 1st email is 0 in theparsedMail List etc.
 * @param {int} num 
 * @returns 
 */
function getListIndex(num) {
    return num - 1;
}

async function sendToMonGo(req, res, parsedMail) {
    //Sample Code -> TBC to Email Parser specific Data.

    let attachmentBBIDs = [];
    let b_hasAttachment = hasAttachment(parsedMail);

    if (b_hasAttachment) {
        console.log("Saving Attachment to BlackBlaze")

        // Iterate over each attachment
        for (let attachment of parsedMail.attachments) {
            // Save the attachment to BlackBlaze and get the link
            let link = await saveToBlackBlaze(attachment);

            // Add the link to the attachments array in the request body
            attachmentBBIDs.push(link);
        }

        //Send To BB Object Storage
        console.log("Saving Attachment BackBlaze IDs to MongoDB")
    }

    const db = await connectToDB();
    try {

        if (b_hasAttachment) {
            req.body.attachments = attachmentBBIDs;
        }

        //Attachment needs to save to BlackBlaze / Which is a link to the Files.
        req.body.subject = parsedMail.headers.get('subject');
        req.body.from = parsedMail.headers.get('from');
        req.body.to = parsedMail.headers.get('to');

        req.body.date = parsedMail.headers.get('date'); //This Contains Many info.
        req.body.language = parsedMail.headers.get('content-language'); //This Contains Many info.

        req.body.text = parsedMail.text; //Email Body
        req.body.html = parsedMail.html;

        req.body.headerLines = parsedMail.headerLines; //This Array of headers Contains Many info.
        let obj = Object.fromEntries(parsedMail.headers); //Save headers(Map) to MonGo
        req.body.headers = obj;
        req.body.UID = parsedMail.UID;

        req.body.createdAt = new Date();
        req.body.modifiedAt = new Date();

        // let result = await db.collection("emails").insertOne(req.body);
        // return { id: result.insertedId, status: 201 };

        let result = await db.collection("emails").updateOne(
            { UID: req.body.UID }, // filter
            { $set: req.body }, // update
            { upsert: true } // options
        );
        return { id: result.upsertedId ? result.upsertedId._id : 'No document was upserted.', status: 201 };

    } catch (err) {
        // return res.status(400).json({ message: err.message });
        return { message: err.message, status: 400 };
    } finally {
        await db.client.close();
    }
}


//Sync an email to MonGO DB. (Shall use kebab case for url..) 
router.get('/sync-db/:num', async (req, res) => {

    //Init UID Map and email Id List
    await initList();

    //Safe Check params Num
    let num = validNum(req.params.num);

    //Query the Map from local Email Storage
    const localMails = await getArchive(); //Get Local Email Storage
    await checkSync(localMails, emailIDList); //This Part shall have a Global Parsed List of Mails.

    console.log("Check if Num in Local" + num); //Rember, it is mapped as A String.
    // console.log(localMapIDToUID);
    // console.log(localMapIDToUID.has('1'));

    let query = num.toString();

    if (localMails) {

        //Check if this email (Natural Index) in Server's Storage
        if (localMapIDToUID.has(query)) {

            //Shall Chec Also If There Exist This record in MonGoDB

            console.log("We Have it " + query);

            //Get That parsed Mail from Local
            const parsedMail = localParsedList[getListIndex(num)]; //To get from array, use simple int

            // console.log(parsedMail);
            console.log(`Sending parsedMail No.${num} to Mongo`);

            //Send it to MonGO!
            let db_res = await sendToMonGo(req, res, parsedMail); //Shall Save Link to attachment
            let msg = 'Email Synced: ' + query + ' UID: ' + parsedMail.UID;

            if (db_res.status !== 201) { //Good and created record
                return res.json({ message: msg + ' Failed', return_code: db_res });
            }

            return res.json({ message: msg, return_code: db_res });

        } else { //It doesn't exist in local

            console.log("We Don't Have it " + query);

            //Download it
        }

    } else { //There are no local Storage

        console.log("We Don't Have it " + query);
        //Sync Files!
        console.log("Please Sync to Local First");
    }

    return res.json('Email Not Synced');
});


router.get('/get-attachment/:UID', async (req, res) => {

    const db = await connectToDB();
    try {
        // Query MongoDB for Email with the provided UID
        const email = await db.collection('emails').findOne({ UID: req.params.UID });

        if (!email) {
            return res.status(404).send('Email not found');
        }

        // Assuming email.attachIds is an array of Backblaze File IDs
        const backblazeIds = email.attachments;
        const attachmentLinks = [];
        // Generate Attachment Links using Backblaze IDs
        for (const backblazeId of backblazeIds) {
            const link = await getPrivateDownloadUrl(backblazeId);
            attachmentLinks.push(link);
        }

        // Return the attachment link
        res.send({ attachmentLinks });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

module.exports = router;