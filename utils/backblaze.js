// AUTHOR: CHAN HOK TING

const B2 = require('backblaze-b2');
const fs = require('fs');
const crypto = require('crypto');
const { connectToDB, ObjectId } = require('../utils/db');

//Migrate to new B2 account
// user: 'gcap3056@outlook.com',
// password: 'hkbugcap3055',
// host: 'outlook.office365.com',
// port: 995,
// tls: true

// bucketName: emailsAttachmentsGCAP3056
// bucketID: b21664a12385a4c389e90016
// keyID: 264135439906
// applicationKey: 005d3dd73134434a23a15938a1b256133a2be7973f

/**
 * The name of the bucket in Backblaze B2 Cloud Storage.
 * @type {string}
 */
// const bucketName = 'emailsAttachments';
const bucketName = 'emailsAttachmentsGCAP3056';

/**
 * The application key ID for Backblaze B2 Cloud Storage.
 * @type {string}
 */
// const _applicationKeyId = '0ab1c44967e3'; // replace with your applicationKeyId
const _applicationKeyId = '264135439906'; // replace with your applicationKeyId

/**
 * The application key for Backblaze B2 Cloud Storage.
 * @type {string}
 */
// const _applicationKey = '004b6168e665ab05da5cf694618a2fdc600296e939'; // replace with your applicationKey
const _applicationKey = '005d3dd73134434a23a15938a1b256133a2be7973f'; // replace with your applicationKey

/**
 * The bucket ID for Backblaze B2 Cloud Storage.
 * @type {string}
 */
// const _bucketId = '20eabb11ac54644986d70e13'; // replace with your bucketId
const _bucketId = 'b21664a12385a4c389e90016'; // replace with your bucketId

let uploadedFiles = null; //This is the hash of the content -> prevent dups;

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
        //Shall here download the hashrecord fromMONGO
        uploadedFiles = JSON.parse(fs.readFileSync('uploadedFiles.json'));
    } catch (error) {
        //Reconstduct hash record From MonGO

        console.error('Error loading uploaded files record:', error);

        console.log("Fetching from MongoDB");
        // Fetch all documents from the collection
        let db = await connectToDB();
        let documents = await db.collection('records').find().toArray();

        // Initialize an empty object to store the uploaded files
        uploadedFiles = {};

        // Iterate over the documents to build the uploadedFiles object
        for (let doc of documents) {
            // Use the '_id' field as the key and the rest of the document as the value
            uploadedFiles[doc.hash] = {
                fileID: doc.fileID,
                UID: doc.UID,
                index: doc.index
            };
        }
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
        bucketId: _bucketId,
        fileNamePrefix: '',
        validDurationInSeconds: 3600,
    });

    return auth;
}

/**
 * Save to Backblaze B2 and prevent duplicate by calculating hash.
 * 
 * //Thee reuslt of the upload rescord shall be Upload to Mongo -> to prevent dups if upload Hash is delted in Express.
 *
 * @param {object} b2 - The Backblaze B2 instance.
 * @param {object} attachment - The file to be uploaded.
 * @param {string} attachment.filename - The name of the file.
 * @param {Buffer} attachment.content - The content of the file.
 * @returns {Promise<string>} The file ID of the uploaded file.
 */
async function saveToBackblaze(b2, attachment, UID, index) { //To know which attachment is bad..
    const crypto = require('crypto');
    const fs = require('fs');

    // Calculate the hash of the file content
    const hash = crypto.createHash('sha1');
    hash.update(attachment.content);
    const fileHash = hash.digest('hex');
    // Check if the file has already been uploaded
    if (uploadedFiles[fileHash]) {
        console.log(`Skipping duplicate file: ${attachment.filename} UID${UID}:, index: ${index}`); //Should Include also the UID of Mail, Attachment index for uniute ID.
        return uploadedFiles[fileHash]; // Return the object of (fileId + UID + index) from the record
    }

    //Action if Hash is wrong -> reupload, and Update the new FileID and Hash.
    const response = await b2.getUploadUrl({ bucketId: _bucketId });
    const uploadResponse = await b2.uploadFile({
        uploadUrl: response.data.uploadUrl,
        uploadAuthToken: response.data.authorizationToken,
        fileName: attachment.filename,
        data: attachment.content,
    });

    console.log(`Uploading: ${attachment.filename}`);

    // The file was uploaded successfully
    // Update the record of uploaded files - pack in filedID, UID, attachment index
    uploadedFiles[fileHash] = { fileID: uploadResponse.data.fileId, UID: UID, index: index };
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

//To Export as reference, pass get UploadedFiles Function!
module.exports = { saveToBackblaze, getPrivateDownloadUrl, initBackBlaze_b2, getDownloadAuth_b2, getUploadedFiles: () => uploadedFiles };