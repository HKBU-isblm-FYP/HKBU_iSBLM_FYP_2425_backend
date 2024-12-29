const { BlobServiceClient } = require("@azure/storage-blob");
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


module.exports = { createBlob };