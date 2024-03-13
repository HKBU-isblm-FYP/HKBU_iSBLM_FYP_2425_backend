process.env.TOKEN_SECRET = 'Gcap3056Secret';

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var imapRouter = require('./routes/imap');
var pop3Router = require('./routes/pop3');
var lessonsRouter = require('./routes/lessons');
var projectsRouter = require('./routes/projects');

var json2mdRouter = require('./routes/json2md'); //For Converting JSON to MD
var md2jsonRouter = require('./routes/md2json'); // TBD

var textbooksRouter = require('./routes/textbooks'); // For Serving textbooks in MD format.

var app = express();

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
app.use('/api/projects', passport.authenticate('bearer', { session: false }), projectsRouter);
app.use('/api/json2md', passport.authenticate('bearer', { session: false }), json2mdRouter);
app.use('/api/md2json', passport.authenticate('bearer', { session: false }), md2jsonRouter);
app.use('/api/textbooks', passport.authenticate('bearer', { session: false }), textbooksRouter);

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
