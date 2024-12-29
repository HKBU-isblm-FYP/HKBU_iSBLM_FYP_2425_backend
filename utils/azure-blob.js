const { BlobServiceClient, BlobSASPermissions, generateBlobSASQueryParameters } = require("@azure/storage-blob");
const { v1: uuidv1 } = require('uuid');

const connStr = 'DefaultEndpointsProtocol=https;AccountName=isblmfiles;AccountKey=AGJ4u/rgBe5SHH1a09DXLfiZ/mm12r1QN8YBFbUVhlv3SN/4F8A+yeK0UeM4WidrtQ55j+bxt8Zx+ASt8/o8Ng==;EndpointSuffix=core.windows.net';

const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);

const containerName = "isblmfiles";

// Create a blob 
async function createBlob(fileName, fileContent) {
    const containerClient = blobServiceClient.getContainerClient(containerName);
  
    const content = fileContent;

    // Retrieve the file extension
    const ext = fileName.split('.').pop();

    // Create a unique filename
    const blobName = `${uuidv1()}.${ext}`;

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const uploadBlobResponse = await blockBlobClient.upload(content, content.length);
    console.log(`Upload block blob ${blobName} successfully`, uploadBlobResponse.requestId);

    return { blobName: blobName, url: blockBlobClient.url };
}
// Create a service SAS for a blob
function getBlobSasUri(containerClient, blobName, sharedKeyCredential, storedPolicyName) {
    const sasOptions = {
        containerName: containerClient.containerName,
        blobName: blobName
    };

    if (storedPolicyName == null) {
        sasOptions.startsOn = new Date();
        sasOptions.expiresOn = new Date(new Date().valueOf() + 3600 * 1000);
        sasOptions.permissions = BlobSASPermissions.parse("r");
    } else {
        sasOptions.identifier = storedPolicyName;
    }

    const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();
    console.log(`SAS token for blob is: ${sasToken}`);

    return `${containerClient.getBlockBlobClient(blobName).url}?${sasToken}`;
}

// A wrapper function to generate SAS token
function generateBlobSasUri(blobName) {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const sharedKeyCredential = blobServiceClient.credential;

    return getBlobSasUri(containerClient, blobName, sharedKeyCredential, null);
}

module.exports = { createBlob };