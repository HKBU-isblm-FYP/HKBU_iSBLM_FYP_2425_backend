const B2 = require('backblaze-b2');
const fs = require('fs');
const crypto = require('crypto');

/**
 * The name of the bucket in Backblaze B2 Cloud Storage.
 * @type {string}
 */
const bucketName = 'emailsAttachments';

/**
 * The application key ID for Backblaze B2 Cloud Storage.
 * @type {string}
 */
const _applicationKeyId = '0ab1c44967e3'; // replace with your applicationKeyId

/**
 * The application key for Backblaze B2 Cloud Storage.
 * @type {string}
 */
const _applicationKey = '004e9a7e308d94c74bfab07b91dc9237ff5d20d96b'; // replace with your applicationKey

/**
 * The bucket ID for Backblaze B2 Cloud Storage.
 * @type {string}
 */
const _bucketId = '20eabb11ac54644986d70e13'; // replace with your bucketId

let uploadedFiles = null;

/**
 * 
 * @returns {Promise<B2>} Returns an authorized B2 instance for later upload and download
 */
async function initBackBlaze_b2() {
    const b2 = new B2({
        applicationKeyId: _applicationKeyId,
        applicationKey: _applicationKey
    });

    try {
        await b2.authorize();
        console.log("B2 Authorized");
    } catch (error) {
        console.error('Error authorizing B2:', error);
        throw error;
    }

    try {
        uploadedFiles = JSON.parse(fs.readFileSync('uploadedFiles.json'));
    } catch (error) {
        console.error('Error loading uploaded files record:', error);
        uploadedFiles = {};
    }

    return b2;
}

/**
 * Function to get Download Authorization for a bucket in Backblaze B2 Cloud Storage
 * @param {object} b2 - Instance of B2 
 * @param {string} bucketId - Unique identifier for the bucket
 * @param {string} fileNamePrefix - Prefix for the file name
 * @param {number} validDurationInSeconds - Duration for which the authorization is valid in seconds
 * @returns {Promise<string>} - Returns a promise that resolves to the authorization token
 */
async function getDownloadAuth_b2(b2, bucketId, fileNamePrefix = '', validDurationInSeconds = 3600) {
    const auth = await b2.getDownloadAuthorization({
        bucketId : _bucketId,
        fileNamePrefix : '',
        validDurationInSeconds: 3600,
    });

    return auth;
}

/**
 * Save to Backblaze B2 and prevent duplicate by calculating hash.
 *
 * @param {object} b2 - The Backblaze B2 instance.
 * @param {object} attachment - The file to be uploaded.
 * @param {string} attachment.filename - The name of the file.
 * @param {Buffer} attachment.content - The content of the file.
 * @returns {Promise<string>} The file ID of the uploaded file.
 */
async function saveToBackblaze(b2, attachment) {
    const crypto = require('crypto');
    const fs = require('fs');

    // Calculate the hash of the file content
    const hash = crypto.createHash('sha1');
    hash.update(attachment.content);
    const fileHash = hash.digest('hex');
    // Check if the file has already been uploaded
    if (uploadedFiles[fileHash]) {
        console.log(`Skipping duplicate file: ${attachment.filename}`);
        return uploadedFiles[fileHash]; // Return the fileId from the record
    }

    const response = await b2.getUploadUrl({ bucketId: _bucketId });
    const uploadResponse = await b2.uploadFile({
        uploadUrl: response.data.uploadUrl,
        uploadAuthToken: response.data.authorizationToken,
        fileName: attachment.filename,
        data: attachment.content,
    });

    console.log(`Uploading: ${attachment.filename}`);

    // The file was uploaded successfully
    // Update the record of uploaded files
    uploadedFiles[fileHash] = uploadResponse.data.fileId;
    fs.writeFileSync('uploadedFiles.json', JSON.stringify(uploadedFiles));

    return uploadResponse.data.fileId;
}

/**
 * This function generates a private download URL for a file stored in Backblaze B2 Cloud Storage.
 *
 * @async
 * @param {Object} b2 - The Backblaze B2 instance.
 * @param {string} downloadAuth - The download authorization token.
 * @param {string} backblazeID - The file ID on Backblaze B2.
 * @returns {string} - The private download URL for the file.
 */
async function getPrivateDownloadUrl(b2, downloadAuth, backblazeID) {
    const fileInfo = await b2.getFileInfo({ fileId: backblazeID });
    const fileName = fileInfo.data.fileName;
    console.log(`Getting: ${fileName}`);
    const downloadUrl = `${b2.downloadUrl}/file/${bucketName}/${fileName}?Authorization=${downloadAuth.data.authorizationToken}`;
    return downloadUrl;
}


module.exports = { saveToBackblaze, getPrivateDownloadUrl, initBackBlaze_b2, getDownloadAuth_b2 };