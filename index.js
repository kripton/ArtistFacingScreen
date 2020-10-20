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
  text: '[Connecting to Mumble ...]',
  mode: 'clock',
  countdownRunning: false,
  countdownEnd: ''
}

// Simply serve index.html when asked for /
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  console.log('NEW  connection from "' + socket.conn.remoteAddress + '" (' +
    socket.conn.request.headers['user-agent'] + ')');

  // Send the current state to all connected clients
  io.emit('update', state);

  // Simply inform when a user disconnects
  socket.on('disconnect', (reason) => {
    console.log('LOST connection from "' + socket.conn.remoteAddress + '" (' +
      reason + ')');
  });
});

http.listen(8123, () => {
  console.log('HTTP listening on *:8123');
});

const client = new NoodleJS({
  url: '127.0.0.1'
});

client.on('ready', info => {
  console.log('Connected to Mumble server:', info);
  state.text = '[Connected to Mumble]';
});

client.on('message', message => {
  console.log(message);
  if (message.content.startsWith('!')) {
    if (message.content.startsWith('!text')) {
      state.mode = 'text';
    } else if (message.content.startsWith('!clock')) {
      state.mode = 'clock';
    } else if (message.content.startsWith('!countdown')) {
      state.mode = 'countdown';
      // If no further parameters are given, make it 60 minutes and PAUSE
      if (message.content === '!countdown') {
        var now = new Date();
        var end =  new Date(now.getTime() + 60000);
        state.countdownEnd = end.toISOString();
        state.countdownRunning = true;
      }
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
