var express = require('express');
var router = express.Router();
var fs = require('fs'), fileStream;

const Imap = require('imap');
const inspect = require('util').inspect;

const imapConfOutlook = {
  user: 'gcap3056@outlook.com',
  password: 'hkbugcap3055',
  // host: 'imap-mail.outlook.com',
  host: 'outlook.office365.com',
  port: 993,
  tls: true,
}


const imapConfGmail = {
  user: 'gcap3056@gmail.com',
  password: 'hkbugcap3055',
  // host: 'imap-mail.outlook.com',
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false },
  authTimeout: 3000, // Timeout for authentication (in milliseconds)
  connTimeout: 3000, // Connection timeout (in milliseconds)
  keepalive: false   // Disables the keepalive mechanism
}

const imap = new Imap(imapConfOutlook);

// const imap = new Imap({
//   user: 'gcap3056@outlook.com',
//   password: 'hkbugcap3055',
//   host: 'imap-mail.outlook.com',
//   port: 993,
//   tls: true
// });

function openInbox(cb) {
  imap.openBox('INBOX', true, cb);
}

async function getEmails() {
  // console.log(imap);
  imap.once('ready', function () {
    openInbox(function (err, box) {
      if (err) throw err;
      var f = imap.seq.fetch(box.messages.total + ':*', { bodies: ['HEADER.FIELDS (FROM)', 'TEXT'] });
      f.on('message', function (msg, seqno) {
        console.log('Message #%d', seqno);
        var prefix = ' (#' + seqno + ') ';
        msg.on('body', function (stream, info) {
          if (info.which === 'TEXT')
            console.log(prefix + 'Body [%s] found, %d total bytes', inspect(info.which), info.size);
          var buffer = '', count = 0;
          stream.on('data', function (chunk) {
            count += chunk.length;
            buffer += chunk.toString('utf8');
            if (info.which === 'TEXT')
              console.log(prefix + 'Body [%s] (%d/%d)', inspect(info.which), count, info.size);
          });
          stream.once('end', function () {
            if (info.which !== 'TEXT')
              console.log(prefix + 'Parsed header: %s', inspect(Imap.parseHeader(buffer)));
            else
              console.log(prefix + 'Body [%s] Finished', inspect(info.which));
          });
        });
        msg.once('attributes', function (attrs) {
          console.log(prefix + 'Attributes: %s', inspect(attrs, false, 8));
        });
        msg.once('end', function () {
          console.log(prefix + 'Finished');
        });
      });
      f.once('error', function (err) {
        console.log('Fetch error: ' + err);
      });
      f.once('end', function () {
        console.log('Done fetching all messages!');
        imap.end();
      });
    });
  });

  imap.once('error', function (err) {
    console.log(err);
  });

  imap.once('end', function () {
    console.log('Connection ended');
  });

  imap.connect();
}

async function downloadEmails() {

  const imap = new Imap(imapConfOutlook);

  openInbox(function (err, box) {
    if (err) throw err;
    imap.search(['UNSEEN', ['SINCE', 'May 20, 2010']], function (err, results) {
      if (err) throw err;
      var f = imap.fetch(results, { bodies: '' });
      f.on('message', function (msg, seqno) {
        console.log('Message #%d', seqno);
        var prefix = '(#' + seqno + ') ';
        msg.on('body', function (stream, info) {
          console.log(prefix + 'Body');
          stream.pipe(fs.createWriteStream('msg-' + seqno + '-body.txt'));
        });
        msg.once('attributes', function (attrs) {
          console.log(prefix + 'Attributes: %s', inspect(attrs, false, 8));
        });
        msg.once('end', function () {
          console.log(prefix + 'Finished');
        });
      });
      f.once('error', function (err) {
        console.log('Fetch error: ' + err);
      });
      f.once('end', function () {
        console.log('Done fetching all messages!');
        imap.end();
      });
    });
  });
}

// Get Emails
router.get('/get-emails', async (req, res) => {
  console.log("Getting mails")
  const emails = await getEmails();
  res.json(emails);
});

// Download Emails
router.get('/download-emails', async (req, res) => {
  // Your code to download emails goes here
  // const emails = await downloadEmails();
  // res.json(emails);
});

// Read Emails
router.get('/read-emails', (req, res) => {
  // Your code to read emails goes here
});

module.exports = router;
