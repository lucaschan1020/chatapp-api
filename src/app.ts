import express from 'express';
import http from 'http';
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

app.get('/', function (req, res) {
  res.send('index.html');
});

//Whenever someone connects this gets executed
io.on('connection', (socket) => {
  socket.on('SendChatMessage', (chatContent: string) => {
    socket.broadcast.emit('SendChatMessage', chatContent);
  });
  console.log('A user connected');

  //Whenever someone disconnects this piece of code executed
  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

server.listen(serverPort, function () {
  console.log(`listening on *:${serverPort}`);
});
