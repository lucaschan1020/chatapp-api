import express from 'express';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';

const app = express();
const server = new http.Server(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET'],
  },
});
const serverPort: number = 5000;

io.on('connection', (socket) => {
  socket.on('SendChatMessage', (chatContent: string) => {
    socket.broadcast.emit('SendChatMessage', chatContent);
  });
  console.log('A user connected');

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

app.use('/', express.static(__dirname + '/public'));

app.get('*', function (req, res) {
  res.sendFile(path.resolve(__dirname, './public/index.html'));
});

server.listen(serverPort, function () {
  console.log(`listening on *:${serverPort}`);
});
