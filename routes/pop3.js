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
const fs = require('fs');
const { simpleParser } = require('mailparser');
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

// let phrasedEmail = null;

let hasInit = false;

async function initList() {

    if (hasInit) {
        return;
    }

    emailIDList = await pop3.UIDL(); //Return an [[i, j]...] Array of Object. (I is the natural Index, j is the UID of mail)
    createMaps(emailIDList, mapUIDToID, mapIDToUID);

    hasInit = true;

    pop3.QUIT();
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

/**
 * 
 * To Skip the effort of redownloading everything -> Purpose of This Function
 * Procedures: Check the UID of Local Storage object comapare to Server's Mails UID.
 * @param {localRawMailStoragte} backup 
 * @param {ServerIDListFresh} emailIDList 
 * @returns 
 */
async function checkSync(backup, emailIDList) {

    console.log("Enter CheckAndSync")

    const parsedBak = await praseMailList(backup, emailIDList); //I shall also Store the Local UID in Here.

    //Problem 1 -> How to Get the UID of Local. - Solved by Injecting UID!
    // parsedBak.forEach(x => console.log(x.UID));

    //Get a list of missing mails -> Redownload them
    let sameUIDList = [];
    let sameIndexList = [];

    for (let i = 0; i < emailIDList.length; i++) {
        let sUid = emailIDList[i][1];

        for (let j = 0; j < parsedBak.length; j++) {
            let pUid = parsedBak[j].UID;

            if (sUid === pUid) {
                sameUIDList.push(sUid);

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
        console.log(typeof j)
        const mail = await pop3.RETR(j, 0);
        emailsList.push(mail);
        // console.log("Getting Email Index No." + j);
        // console.log("Getting Email Index No." + (j + 1));
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

    // let MAX = emailIDList.length; //For Limit the num, Test purpose;
    let MAX = 5; //For Limit the num, Test purpose;

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
        // }

        console.log(missingIndexList);
        console.log("Back At GetMailList");

        MAX = 10; //TESTING LIMIT

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
//Phrase the List to email with attributes for access -> also add the UID attributes to the object.
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

// GET an EmailList from MailBox
router.get('/list', async (req, res) => {

    // Fetch list of all emails
    await initList();

    let emailsList = await getMailList(pop3, emailIDList);

    await pop3.QUIT();

    let parsedList = await praseMailList(emailsList, emailIDList); //Need to resolve promise
    // console.log('List Len:' + emailsList.length);

    let emailNameList = [];

    for (let i = 0; i < parsedList.length; i++) {
        // console.log('In Da Loop'append)
        const subject = parsedList[i].subject;
        // console.log(parsedList[i]);
        // console.log(subject);
        emailNameList.push(subject);
    }

    // console.log(emailIDList);
    // console.log(parsedList[0]);

    res.json({ list: emailNameList, Count: emailIDList.length }); // I have yet to figure This Thang out.
});

//Get an Email
router.get('/email/:num', async (req, res) => {

    var num = req.params.num || 1;
    if (num < 1) { num = 1 };

    console.log('Getting Email No.' + num);

    const rawEmail = await pop3.RETR(num);

    await pop3.QUIT();

    const phrasedEmail = await simpleParser(rawEmail);

    // res.json(phrasedEmail);
    result = {
        subject: phrasedEmail.subject,
        attachment: phrasedEmail.attachment != null
    }

    console.log(phrasedEmail)

    res.json(phrasedEmail);
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

async function sendToMonGo(parsedMail) {
    //Sample Code -> TBC to Email Parser specific Data.
    const db = await connectToDB();
    try {
        req.body.numTickets = parseInt(req.body.numTickets);
        req.body.terms = req.body.terms == "on";
        req.body.createdAt = new Date();
        req.body.modifiedAt = new Date();

        let result = await db.collection("bookings").insertOne(req.body);
        res.status(201).json({ id: result.insertedId });
    } catch (err) {
        res.status(400).json({ message: err.message });
    } finally {
        await db.client.close();
    }
}

//Sync One email to MonGO DB. (Shall use kebab case for url..) 
router.get('/sync-email/:num', async (req, res) => {

    //Init UID Map and email Id List
    await initList();

    //Safe Check params Num
    let num = validNum(req.params.num);

    //Query the Map from local Email Storage
    const localMails = await getArchive(); //Get Local Email Storage
    await checkSync(localMails, emailIDList); //This Part shall have a Global Parsed List of Mails.

    console.log("Check if Num in Local" + num); //Rember, it is mapped as A String.
    console.log(localMapIDToUID);
    console.log(localMapIDToUID.has('1'));

    let query = num.toString();

    if (localMails) {

        //Check if this email (Natural Index) in Server's Storage
        if (localMapIDToUID.has(query)) {
            console.log("We Have it " + query);

            //Get That Mail from Local
            const mail = null

            //Phrase it
            const parsedMail = null;

            //Send it to MonGO!
            // sendToMonGo(parsedMail);

            return res.json('Email Synced: ' + query);
        } else { //It doesn't exist in local

            console.log("We Don't Have it " + query);

            //Download it
        }

    } else { //There are no local Storage

        console.log("We Don't Have it " + query);
        //Download it
    }

    return res.json('Email Not Synced');
});

module.exports = router;