// Dependencies

var express = require('express')
  , http = require('http')
  , config = require('./config')
  , path = require('path')
  , Zencoder = require ('zencoder')
  , app = express()
  , server = http.createServer(app)
  , io = require('socket.io').listen(server);

// Instantiate a new Zencoder client with the API key from our config file
var zc = new Zencoder(config.zencoder.api_key);

// App configuration for Express
app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

// Set up some local variables. For now we'll just use this
// to pass our Filepicker API key along to the client from config.
app.locals({
  filepicker: config.filepicker
});

// GET /
// Default index route.
app.get('/', function(req, res){
  res.render('index', { title: 'Zensockets!' });
});

// POST /notify/some-unique-id
// Zencoder will publish notifications to this route.
app.post('/notify/:id', function(req, res) {
  res.send(501);
});

// POST /job
// Sends the API request to Zencoder.
app.post('/job', function(req, res) {
  var input = req.body.input_file;
  var channel = req.body.channel;

  zc.Job.create({
    input: input,
    outputs: config.zencoder.outputs()
  }, function(err, data) {
    if (err) {
      io.sockets.emit(channel, {error: true, type: 'job.create', message: 'Something has gone terribly wrong...', error: err});
      return;
    }
    io.sockets.emit(channel, {type: 'job.create', message: 'Job created!', job_id: data.id, outputs: data.outputs})
  });
  res.send(202, {message: 'Success!', notification_namespace: channel});
});

// Emit a message on the system channel every time a client connects
io.sockets.on('connection', function (socket) {
  socket.emit('system', { message: 'Connected!' });
});

// Tell the server to start listening
server.listen(app.get('port'), function(){
  console.log("Zensockets started on port " + app.get('port'));
});
