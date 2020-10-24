// Date and time tool
const moment = require('moment');

// Mumble client
const NoodleJS = require('noodle.js');

// HTTP server with WebSocket support
const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Save the current mode and message so we can update
// the clients when they connect and don't have to wait
// for a new message/command in Mumble
var state = {
  mode: 'clock',
  timestring: '<b>??:??:??</b><br />',
  text: '[Connecting to Intercom ...]',
  countdownRunning: false,
  countdownRemaining: 3600000,
  countdownEnd: ''
}

function updateTimeString() {
  if (state.mode === 'clock') {
    state.timestring = '<b>' + moment().format('HH:mm:ss') + '</b><br />';
  } else if (state.mode === 'countdown') {
    var textColor = "black"
    if (state.countdownRunning) {
      // Update the remaining time
      state.countdownRemaining = state.countdownEnd - moment();

      // Inform the operator about the time remaining
      var remaining = moment.duration(state.countdownRemaining);
      var reportDiff = moment() - state.countdownLastReport;
      // Once every 30s for duration > 1min, every 10s for <=1min and every s for <=10s
      if (
        ((remaining > 60000) && (reportDiff >= 30000)) ||
        ((remaining <= 60000) && (reportDiff >= 10000)) ||
        ((remaining <= 10000) && (reportDiff >= 1000))
      ) {
        client.sendMessage('Countdown remaining: <b>' + moment.utc(state.countdownRemaining).format('HH:mm:ss') + '</b>');
        state.countdownLastReport = moment();
      }

      if (state.countdownRemaining <= 0) {
        state.countdownRemaining = 0;
        state.countdownRunning = false;
        textColor = 'red';
        client.sendMessage('Countdown remaining: <span style="font-weight: bold; color: red;">00:00:00</span>');
      }
    }
    if (state.countdownRemaining <= 0) {
      textColor = 'red';
    }
    state.countdownDisplay = moment.utc(state.countdownRemaining).format("HH:mm:ss")
    state.timestring = '<span style="font-weight: bold; color: ' + textColor + ';">' + state.countdownDisplay + '</span><br />';
  } else {
    state.timestring = '';
  }
}

function updateClients() {
  updateTimeString();
  io.emit('update', state);
}

// Update all clients periodically
setInterval(updateClients, 200);

// Simply serve index.html when asked for /
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  console.log('NEW  connection from "' + socket.conn.remoteAddress + '" (' +
    socket.conn.request.headers['user-agent'] + ')');

  // Send the current state to all connected clients
  updateClients();

  // Simply inform when a user disconnects
  socket.on('disconnect', (reason) => {
    console.log('LOST connection from "' + socket.conn.remoteAddress + '" (' +
      reason + ')');
  });
});

http.listen(8123, () => {
  console.log('HTTP listening on *:8123');
});

// Connect to Mumble server
const client = new NoodleJS({
  url: '127.0.0.1',
  name: 'ArtistFacingScreen'
});

client.on('ready', info => {
  console.log('Connected to Mumble server:', info);
  state.text = '[Connected to Mumble]';

  console.log('===== Channels: =====\n', client.channels);
  console.log('===== Users: =====\n', client.users);
  console.log('=====');

  // Find the correct channel and switch if found
  for (var [key, value] of client.channels) {
    console.log(key + " = ", value.name);
    if (value.name === 'Artist Facing Screens') {
      console.log('Switching :)');
      client.switchChannel(key).then(() => {
        //client.startListeningToChannel(1).then(() => {
        //  console.log('Success');
        //});
      });
    }
  }
});

client.on('voiceData', (voiceData) => {
  //console.debug('voiceData FROM:' + voiceData.sender + ' Sequence:' + voiceData.sequence + ' decodedData.length:' + voiceData.decodedData.length);
  console.debug('voiceData:', voiceData);
});

//client.on('error', error => {
//  console.warn('Mumble error :( :', error);
//  console.warn('Since reconnecting does not work with Noodle.JS, we quit :)');
//});

client.on('message', message => {
  console.log('===== Message: =====\n', message);
  console.log('=====');
  if (message.content.startsWith('!')) {
    if (message.content.startsWith('!text')) {
      state.mode = 'text';
    } else if (message.content.startsWith('!clock')) {
      state.mode = 'clock';
    } else if (message.content.startsWith('!countdown')) {
      state.mode = 'countdown';
      state.countdownLastReport = moment() - 900;
      if (message.content === '!countdown') {
        // If no further parameters are given, make it 60 minutes and PAUSE
        state.countdownRemaining = 60 * 60 * 1000;
        state.countdownEnd = '';
        state.countdownRunning = false;
      } else if (message.content.includes(' ')) {
        if (message.content.split(' ')[1].includes(':')) {
          // An end time has been given
          var timeParts = message.content.split(' ')[1].split(':');
          var end = moment();
          end.set('hour', timeParts[0]);
          end.set('minute', timeParts[1]);
          if (timeParts[2]) {
            end.set('second', timeParts[2]);
          } else {
            end.set('second', 0);
          }
          state.countdownEnd = end;
          state.countdownRunning = true;
          if (message.content.split(' ')[2] && (message.content.split(' ')[2].toLowerCase() === 'pause')) {
            state.countdownRunning = false;
          }
        } else if (message.content.split(' ')[1].toLowerCase() === 'run') {
          // Run a paused countdown
          if (state.countdownEnd == '') {
            state.countdownEnd = moment() + state.countdownRemaining;
          }
          state.countdownRunning = true;
        } else if (message.content.split(' ')[1].toLowerCase() === 'pause') {
          // Pause a running countdown
          state.countdownRemaining = state.countdownEnd - moment();
          state.countdownEnd = '';
          state.countdownRunning = false;
        } else {
          // A time in minutes has been given. Default: PAUSE
          var parts = message.content.split(' ')[1].split('+');
          state.countdownRemaining = parts[0] * 60 * 1000;
          if (parts[1]) {
            state.countdownRemaining += parts[1] * 1000;
          }
          state.countdownEnd = '';
          state.countdownRunning = false;
          if (message.content.split(' ')[2] && (message.content.split(' ')[2].toLowerCase() === 'run')) {
            state.countdownEnd = moment.now() + state.countdownRemaining;
            state.countdownRunning = true;
          }
        }
      }
      updateTimeString();
    } else {
      // Invalid mode
      client.sendMessage('<span style="color: red;">Invalid command. Valid: <b>!text</b>, <b>!clock<b/>, <b>!countdown</b></span>');
    }
  } else {
    state.text = message.content;
  }

  io.emit('update', state);
});

client.connect();
