const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;

const oauth2Client = new OAuth2(
    '740999275245-vj3ldcpt875de67mitv2irseupue74h6.apps.googleusercontent.com', // Client ID
    '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', // Client Secret
    'https://developers.google.com/oauthplayground' // Redirect URL
);

oauth2Client.setCredentials({
    refresh_token: '1//04f1heSOOC-drCgYIARAAGAQSNwF-L9IrdL7prI0-1pcEGR14dS6_ebpd7UYKOqlO3f9dXQ_7Sdk8KZJZgabRiQmTB2FhkB-IxNA'
});

const createTransporter = async () => {
    try {
        const accessToken = await oauth2Client.getAccessToken();

        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: 'isblmfyp@gmail.com',
                clientId: '740999275245-vj3ldcpt875de67mitv2irseupue74h6.apps.googleusercontent.com',
                clientSecret: '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',
                refreshToken: '1//04f1heSOOC-drCgYIARAAGAQSNwF-L9IrdL7prI0-1pcEGR14dS6_ebpd7UYKOqlO3f9dXQ_7Sdk8KZJZgabRiQmTB2FhkB-IxNA',
                accessToken: accessToken.token
            },
        });
    } catch (error) {
        console.error('Failed to create transporter:', error);
        throw new Error('Failed to create transporter');
    }
};

const sendEmail = async (to, subject, text) => {
    try {
        const transporter = await createTransporter();

        const mailOptions = {
            from: '"iSBLM" <isblmfyp@gmail.com>', // Sender address
            to: to, // List of recipients
            subject: subject, // Subject line
            text: text, // Plain text body
            html: `<p>${text}</p>` // HTML body
        };

        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

module.exports = { sendEmail };