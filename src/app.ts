import express from 'express';
import http from 'http';
import authRoutes from './components/auth/auth.route';
import chatRoutes from './components/chat/chat.route';
import friendRoutes from './components/friend/friend.route';
import privateChannelRoutes from './components/private-channel/private-channel.route';
import { PORT } from './config/env-keys';
import { connectToDatabase } from './infrastructure/database';
import { initializeSocketIO } from './infrastructure/socket-io';
import errorHandlerMiddleware from './middleware/error-handler.middleware-maker';

const app = express();
const server = new http.Server(app);
connectToDatabase()
  .then(() => {
    app.use(express.json());
    initializeSocketIO(server);

    app.get('/api/readyz', (_req, res) =>
      res.status(200).json({ status: 'ok' })
    );
    app.get('/api/livez', (_req, res) =>
      res.status(200).json({ status: 'ok' })
    );

    app.use('/api/auth', authRoutes);
    app.use('/api/friend', friendRoutes);
    app.use('/api/private-channel', privateChannelRoutes);
    app.use('/api/chat', chatRoutes);

    app.use(errorHandlerMiddleware.handleError);

    server.listen(PORT, function () {
      console.log(`listening on *:${PORT}`);
    });
  })
  .catch((error: Error) => {
    console.error('Database connection failed', error);
    process.exit();
  });
