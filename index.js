const NoodleJS = require('noodle.js');
const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  console.log('a user connected');
});

io.on('connection', (socket) => {
  console.log('a user connected');
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

http.listen(8123, () => {
  console.log('listening on *:8123');
});

const client = new NoodleJS({
    url: '127.0.0.1'
});

client.on('ready', info => {
    console.log('CONNECTED:', info);
});

client.voiceConnection.on('end', param => {
    console.log('end');
});

client.on('message', message => {
    console.log(message);
    if (message.content === 'ping') {
        message.reply('pong');
    } else if (message.content === 'C') {
        client.voiceConnection.playFile('call.mp3');
        client.voiceConnection.playFile('call.mp3');
        client.voiceConnection.playFile('call.mp3');
    }
    io.emit('text', {'text': message.content})
});

client.connect();
