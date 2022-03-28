import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import authRoutes from './routes/auth';
import friendRoutes from './routes/friend';
import privateChannelRoutes from './routes/privateChannel';
import chatRoutes from './routes/chat';

const app = express();
const server = new http.Server(app);
app.use(
  cors({
    origin: 'http://localhost:3000',
  })
);
app.use(express.json());

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

app.use('/api/auth', authRoutes);
app.use('/api/friend', friendRoutes);
app.use('/api/privateChannel', privateChannelRoutes);
app.use('/api/chat', chatRoutes);

app.get('*', function (_req, res) {
  res.sendFile(path.resolve(__dirname, './public/index.html'));
});

server.listen(process.env.PORT || serverPort, function () {
  console.log(`listening on *:${process.env.PORT || serverPort}`);
});
