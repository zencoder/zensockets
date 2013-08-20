// Dependencies

var express = require('express')
  , http = require('http')
  , config = require('./config')
  , path = require('path')
  , Zencoder = require ('zencoder')
  , app = express()
  , server = http.createServer(app)
  , io = require('socket.io').listen(server)
  , Datastore = require('nedb');

// Instantiate a new Zencoder client with the API key from our config file
var zc = new Zencoder(config.zencoder.api_key);

// Set up our data stores
var Media = new Datastore({ filename: 'db/media', autoload: true });

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
  Media.find({state: "finished"}, function(err, docs) {
    res.render('index', { title: 'Zensockets!', jobs: docs });
  })
});

// POST /notify/some-unique-id
// Zencoder will publish notifications to this route.
app.post('/notify/:id', function(req, res) {
  // Let Zencoder know we got the message
  res.send(202, {message: "Thanks, Zencoder! We will take it from here."});

  // Check and make sure it's a job notification (and not just an output)
  // before saving.
  if (req.body.outputs) {
    // this is what will actually get inserted into the DB
    var jobDoc = {
      zencoder_id: req.body.job.id,
      input: req.body.input,
      outputs: {}
    };

    // Check the job status so we can know if it was successful
    if (req.body.job.state == 'finished') {
      jobDoc.state = "finished"
    } else {
      jobDoc.state = "failed"
    }

    req.body.outputs.forEach(function(output) {
      console.log(output);
      // We only include thumbnails for one output, so use that one
      if (output.thumbnails) {
        // To keep things simple, just grab the first thumb
        var thumb = output.thumbnails[0].images[0]
        jobDoc.thumbnail = {
          url: thumb.url,
          size: thumb.dimensions
        }
      }

      jobDoc.outputs[output.label] = {
        url: output.url,
        format: output.format,
        width: output.width,
        height: output.height
      }
    });

    Media.update({_id: req.body.job.pass_through}, jobDoc, function(err, doc) {
      if (err) {
        console.log(err);
        return;
      }
      // We're done! Let the client know. We also want the notification to
      // include the document id, so add that to the object first.
      jobDoc._id = req.body.job.pass_through;
      io.sockets.emit(req.params.id, jobDoc);
    });
  }
});

// POST /job
// Sends the API request to Zencoder.
app.post('/job', function(req, res) {
  var input = req.body.input_file;
  var channel = req.body.channel;
  var notification_url = config.zencoder.notification_url + channel;

  Media.insert({submitted_at: new Date(), state: 'submitting'}, function(err, newDoc) {
    res.send(202, {message: 'Success!', internal_record: newDoc._id, notification_namespace: channel});

    zc.Job.create({
      input: input,
      notifications: notification_url,
      pass_through: newDoc._id,
      outputs: config.zencoder.outputs(newDoc._id)
    }, function(err, data) {
      if (err) {
        io.sockets.emit(channel, {error: true, type: 'job.create', message: 'Something has gone terribly wrong...', error: err});
        Media.update({_id: newDoc._id}, {$set: {state: 'pending'}});
        return;
      }
      Media.update({_id: newDoc._id}, {$set: {state: 'transcoding'}});
      io.sockets.emit(channel, {type: 'job.create', message: 'Job created!', job_id: data.id, outputs: data.outputs})
    });
  });
});

// GET /media/:id
// Retrieve specific media item
app.get('/media/:id', function(req, res) {
  Media.findOne({_id: req.params.id}, function(err, media) {
    if (err){ res.send(500); return; }
    if (media) {
      res.send(200, {media: media});
    } else {
      res.send(404, {message: 'Media not found'});
    }
  });
});

// Emit a message on the system channel every time a client connects
io.sockets.on('connection', function (socket) {
  socket.emit('system', { message: 'Connected!' });
});

// Tell the server to start listening
server.listen(app.get('port'), function(){
  console.log("Zensockets started on port " + app.get('port'));
});
