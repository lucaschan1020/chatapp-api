import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { connectToDatabase } from './database';
import authRoutes from './routes/auth';
import chatRoutes from './routes/chat';
import friendRoutes from './routes/friend';
import privateChannelRoutes from './routes/privateChannel';
import { initializeSocketIO } from './socketIO';

const app = express();
const server = new http.Server(app);
const serverPort: number = 5000;
connectToDatabase()
  .then(() => {
    app.use(express.json());
    initializeSocketIO(server);

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
  })
  .catch((error: Error) => {
    console.error('Database connection failed', error);
    process.exit();
  });
