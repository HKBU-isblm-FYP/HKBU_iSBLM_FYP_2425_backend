process.env.TOKEN_SECRET = 'Gcap3056Secret';

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

//FIX SPA HISTORY
var history = require('connect-history-api-fallback');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var imapRouter = require('./routes/imap');
var pop3Router = require('./routes/pop3');
var lessonsRouter = require('./routes/lessons');
var coursesRouter = require('./routes/courses');
var projectsRouter = require('./routes/projects');
var modulesRouter = require('./routes/modules');
var gptRouter = require('./routes/gpt');
var json2mdRouter = require('./routes/json2md'); //For Converting JSON to MD
var md2jsonRouter = require('./routes/md2json'); // TBD
var formRouter = require('./routes/form'); // For Serving form data.
var textbooksRouter = require('./routes/textbooks'); // For Serving textbooks in MD format.
var studyplansRouter = require('./routes/studyplans'); 
var dashboardRouter = require('./routes/dashboard'); // For Serving dashboard data.

var app = express();
//FIX SPA HISTORY
// app.use(history());
app.use(history({
  rewrites: [
    { from: /\/api\/.*$/, to: function (context) { return context.parsedUrl.pathname; } }
  ]
}));


//WS UPGRADE
const { createServer } = require("http");
const { Server } = require("socket.io");
const httpServer = createServer(app);
const io = new Server(httpServer, {
  /* options */
  cors: {
    origin: "http://localhost:5173", //ALLOW VUE DEV TO CONNECT
  }
});
io.on("connection", (socket) => {
  console.log("Connected WS", socket.id)
  // Set the socket as a property of the app
  app.set("connSocket", socket); //Let pop3.js to access this connectionSocket!
  socket.emit("foo", "Hello world, connection Soecket established.");
});
httpServer.listen(3000, () => { // NEED TO DISABLE WWW -> Server.listen code
  console.log('listening on *:3000');
});
//WS


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

var jwt = require('jsonwebtoken');
var passport = require('passport');
const { isAdmin } = require('./utils/auth');
var BearerStrategy = require('passport-http-bearer').Strategy;
passport.use(new BearerStrategy(
  function (token, done) {
    jwt.verify(token, process.env.TOKEN_SECRET, function (err, decoded) {
      if (err) { return done(err); }
      return done(null, decoded, { scope: "all" });
    });
  }
));

app.use('/', indexRouter);
app.use('/api/users', passport.authenticate('bearer', { session: false }), usersRouter);
app.use('/api/imap', passport.authenticate('bearer', { session: false }), imapRouter);
app.use('/api/pop3', passport.authenticate('bearer', { session: false }), isAdmin, pop3Router);
app.use('/api/lessons', passport.authenticate('bearer', { session: false }), lessonsRouter);
app.use('/api/courses', passport.authenticate('bearer', { session: false }), coursesRouter);
app.use('/api/projects', passport.authenticate('bearer', { session: false }), projectsRouter);
app.use('/api/json2md', passport.authenticate('bearer', { session: false }), json2mdRouter);
app.use('/api/md2json', passport.authenticate('bearer', { session: false }), md2jsonRouter);
app.use('/api/textbooks', passport.authenticate('bearer', { session: false }), textbooksRouter);
app.use('/api/modules', passport.authenticate('bearer', { session: false }), modulesRouter);
app.use('/api/gpt', passport.authenticate('bearer', { session: false }), gptRouter);
app.use('/api/form', passport.authenticate('bearer', { session: false }), formRouter);
app.use('/api/dashboard', passport.authenticate('bearer', { session: false }), dashboardRouter);
//Serve static upload files;
app.use('/api/uploads', express.static('uploads')); // THE MYTH IS THAT WE HAVE NO PATHREWRITE IN VUE, so each proxy call to /api proxy, still call the /api route in Express.
app.use('/api/studyplans', passport.authenticate('bearer', { session: false }), studyplansRouter);

// Serve the static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
