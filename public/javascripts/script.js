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

  // Listen for system-wide messages
  socket.on('system', function (data) {
    console.log(data);
  });

  // Function for displaying notifications
  function displayNotification (type, title, text) {
    var notification = '<div class="alert alert-'+type+'"><strong>'+title+'</strong> '+text+' <button type="button" class="close" data-dismiss="alert">×</button></div>';
    $('#notifications').append(notification);
  }

});
