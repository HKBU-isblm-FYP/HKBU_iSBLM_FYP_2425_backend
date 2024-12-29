const { EmailClient } = require("@azure/communication-email");

const connectionString = "endpoint=https://emailfyp.japan.communication.azure.com/;accesskey=F0oLPx3E6N3yMmpLvxRgYiM7MqIn8MkoVnOEQhCGPGD73AuvbXjIJQQJ99ALACULyCpZiLXsAAAAAZCSbo8a";
const emailClient = new EmailClient(connectionString);

async function sendEmail(recipient, subject, body) {
    const message = {
        senderAddress: "DoNotReply@5a6d3e81-a76e-4a06-b751-1501cb4fe4ed.azurecomm.net",
        content: {
            subject: subject,
            html: body,
        },
        recipients: {
            to: [
                {
                    address: recipient
                },
            ],
        },
    };

    const poller = await emailClient.beginSend(message);
    const response = await poller.pollUntilDone();

    return response;
}

module.exports = { sendEmail };