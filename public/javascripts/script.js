$(function() {

  var socket = io.connect();

  // Setup things like filepicker and bootstrap
  filepicker.setKey(filepicker_api_key);

  // check if localStorage exists so we can use that to store session info
  // We want a person to still be able to listen for notifications in case they
  // refreshed the page while a video was processing.
  var personalChannel;
  if (localStorage) {
    if (localStorage.personalChannel) {
      // use the channel they've already got if one exists
      personalChannel = localStorage.personalChannel
    } else {
      // Nothing already there, so create a new one
      personalChannel = Math.random().toString(36).substring(7);
      localStorage.personalChannel = personalChannel;
    }
  } else {
    // The user doesn't support localStorage, but give them a channel anyway
    personalChannel = Math.random().toString(36).substring(7);
  }

  // Filepicker Button
  $('#pick').click(function(e) {
    e.preventDefault();
    filepicker.pick(function(FPFile){
      // Disable the picker button while we wait
      $('#pick').addClass('disabled');
      // Set the input source to the newly uploaded file and pass along the user's channel
      videoSrc = FPFile.url;
      // Build a request body with the input file and pass the personal channel to the server
      var request_body = { input_file: videoSrc, channel: personalChannel };
      // Actually POST the request
      $.post('/job', request_body, function(data) {
        // enable the button again
        $('#pick').removeClass('disabled');
        console.log('Sent job request...');
      });
    }, function(FPError){
      // Yikes...something went wrong.
      console.log(FPError.toString());
    });
  });

  // Listen for system-wide messages
  socket.on('system', function (data) {
    console.log(data);
  });

  // Listen for user-specific messages
  socket.on(personalChannel, function(data) {
    if (data.type == 'job.create') { // Just the initial job created callback
      if (!data.error) {
        displayNotification('success', 'Job submitted!', 'File is currently processing. <a href="https://app.zencoder.com/jobs/' + data.job_id + '" target="_blank">View job</a>');
      } else {
        displayNotification('error', 'Request failed', 'We were unable to create a job at this time. Sorry about that.');
      }
    } else {
      jobState(data);
    }
  });

  function jobState(notification) {
    switch(notification.job.state) {
      case 'failed':
        displayNotification('error', 'Job Failed!', 'Some of the outputs may have succeeded, but at least one failed.')
        break;
      case 'finished':
        displayNotification('success', 'Job Success!', 'Congratulations, the job is finished.');
        $('#outputs').html('<video id="transcoded" class="video-js vjs-default-skin" height="360px" width="640"></video>');
        videojs("transcoded", {controls: true}, function() {
          var video = this;
          var outputs = notification.outputs;
          var sources = [];
          $.each(outputs, function(index, value) {
            // we only have two outputs, so if it's not mp4 it's webm
            if (value.format == 'mpeg4') {
              sources.push({type: "video/mp4", src: value.url});
              video.poster(value.thumbnails[0].url);
            } else {
              sources.push({type: "video/webm", src: value.url});
            }
          });
          // set the source
          video.src(sources);
        });
        break;
    }
  }

  // Function for displaying notifications
  function displayNotification (type, title, text) {
    var notification = '<div class="alert alert-'+type+'"><strong>'+title+'</strong> '+text+' <button type="button" class="close" data-dismiss="alert">×</button></div>';
    $('#notifications').append(notification);
  }

});
