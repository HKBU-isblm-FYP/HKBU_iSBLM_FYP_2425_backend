const B2 = require('backblaze-b2');
const fs = require('fs');
const crypto = require('crypto');


const bucketName = 'emailsAttachments';

const _applicationKeyId = '0ab1c44967e3';
const _applicationKey = '004e9a7e308d94c74bfab07b91dc9237ff5d20d96b' // replace with your applicationKey
const _bucketId = '20eabb11ac54644986d70e13';

let uploadedFiles = null;

const b2 = initBackBlaze();

function initBackBlaze() {
    const b2 = new B2({
        applicationKeyId: _applicationKeyId, // replace with your applicationKeyId
        applicationKey: _applicationKey// replace with your applicationKey
    });

    // Load the record of uploaded files
    try {
        uploadedFiles = JSON.parse(fs.readFileSync('uploadedFiles.json'));
    } catch (error) {
        uploadedFiles = {};
    }

    return b2;
}

//Save to backblaze also prevent duplicate by calc hash.
async function saveToBlackBlaze(attachment) {
    await b2.authorize();

    // Calculate the hash of the file content
    const hash = crypto.createHash('sha1');
    hash.update(attachment.content);
    const fileHash = hash.digest('hex');

    // Check if the file has already been uploaded
    if (uploadedFiles[fileHash]) {
        console.log(`Skipping duplicate file: ${attachment.filename}`);
        return uploadedFiles[fileHash]; // Return the fileId from the record
    }

    let response = await b2.getUploadUrl({
        bucketId: _bucketId // replace with your bucketId
    });

    let uploadResponse = await b2.uploadFile({
        uploadUrl: response.data.uploadUrl,
        uploadAuthToken: response.data.authorizationToken,
        fileName: attachment.filename, // replace with your file name
        data: attachment.content, // replace with your file content
    });

    console.log("Uploading: " + attachment.filename);

    // The file was uploaded successfully
    // Update the record of uploaded files
    uploadedFiles[fileHash] = uploadResponse.data.fileId;
    fs.writeFileSync('uploadedFiles.json', JSON.stringify(uploadedFiles));

    return uploadResponse.data.fileId;
}

async function getPrivateDownloadUrl(backblazeID) {

    await b2.authorize();

    // Get the file information
    let fileInfo = await b2.getFileInfo({
        fileId: backblazeID
    });

    let fileName = fileInfo.data.fileName;

    const downloadAuth = await b2.getDownloadAuthorization({
        bucketId: _bucketId, // replace with your bucket id
        fileNamePrefix: fileName, // replace with your file name
        validDurationInSeconds: 3600 // valid for 1 hour
    });

    const downloadUrl = `${b2.downloadUrl}/file/${bucketName}/${fileName}?Authorization=${downloadAuth.data.authorizationToken}`;

    return downloadUrl;
}


module.exports = { saveToBlackBlaze, getPrivateDownloadUrl, B2 };