var express = require('express');
var router = express.Router();

require('events').EventEmitter.defaultMaxListeners = 40;

// const LocalStorage = require('node-localstorage').LocalStorage;
// let localStorage = new LocalStorage('./scratch');
const fs = require('fs');

const { simpleParser } = require('mailparser');
const PopNode = require('node-pop3');

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

router.get('/emails', async (req, res) => {

    // Fetch list of all emails
    let emailsList = await pop3.UIDL();

    console.log(emailsList);

    // Fetch the email content
    let msg = await pop3.RETR(emailsList[1][0]);

    await pop3.QUIT();

    // Parse the email content
    let parsedEmail = await simpleParser(msg);

    res.json(parsedEmail);
});

async function getArchive() {

    // const backup = localStorage.getItem(ARCHIVE);
    console.log("Loading backup")

    const data = await fs.promises.readFile(ARCHIVE, 'utf8');
    const array = data.split('\\n');

    return array;
}

// To Skip the effort of redownloading everything -> Purpose of This Function
async function checkAndSync(backup) {

    console.log("Printing UIDL")

    const ServerIDlist = await pop3.UIDL();

    const parsedBak = await phraseMailList(backup); //I shall also Store the Local UID in Here.

    //Procedures: Check the UID of Local Storage comapare to Server's Mails UID.
    //Problem 1 -> How to Get the UID of Local.
    //Get a list of missing mails -> Redownload them


    parsedBak.forEach(x => console.log(x.UIDL()));

}

async function getMailList(emailIDList) {

    // const MAX = emailIDList.length; //For Limit the num, Test purpose;
    const MAX = 5; //For Limit the num, Test purpose;

    const backup = await getArchive();

    // PLACEHOLDER - Late Need to Sync according to Item ID
    if (backup) {

        console.log("Loaded backup")
        console.log("Checking Sync Status")
        checkAndSync(backup);

        // return backup;
    }


    console.log("Downloading All the Mails");
    let emailsList = [];

    // for (let i = 0; i < emailIDList.length; i++) {
    for (let i = 0; i < MAX; i++) {
        const mail = await pop3.RETR(i + 1, 0);
        emailsList.push(mail);
        console.log("Getting Email No." + (i + 1));
    }

    const data = emailsList.join('\\n');

    fs.writeFile(ARCHIVE, data, function (err) {
        if (err) {
            console.error('Error occurred:', err);
        } else {
            console.log('Email array saved successfully!');
        }
    });

    return emailsList;
}

async function phraseMailList(emailsList) {

    console.log('Parsing List')
    // console.log(emailsList[9]);
    console.log(emailsList.length);

    let parsedList = [];

    for (let i = 0; i < emailsList.length; i++) {
        // parsedList.push(await simpleParser(emailsList[i]));
        let parsed = await simpleParser(emailsList[i]);
        if (!parsed) {
            console.log('Error');
        } else {
            parsedList.push(parsed);
        }

    }

    // console.log(parsedList[0]);
    // console.log("subject")
    // console.log(parsedList[0].subject);
    console.log("Exit parsing")

    return parsedList;
}

// GET an EmailList from MailBox
router.get('/list', async (req, res) => {

    // Fetch list of all emails
    let emailIDList = await pop3.UIDL(); //Return an [[i, j]...] Array of Object.

    console.log(emailIDList);

    let emailsList = await getMailList(emailIDList);

    await pop3.QUIT();

    let parsedList = await phraseMailList(emailsList); //Need to resolve promise
    console.log('List Len:' + emailsList.length);

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


router.get('/sync', async (req, res) => {




    res.json('Email Synced');
});

module.exports = router;