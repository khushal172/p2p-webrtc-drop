const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.get('/', (req, res) => {
  res.send('P2P Mesh Signaling Server is running');
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('create-room', () => {
    const roomId = Math.floor(100000 + Math.random() * 900000).toString();
    socket.join(roomId);
    console.log(`Room created: ${roomId} by ${socket.id}`);
    socket.emit('room-created', { roomId });
  });

  socket.on('join-room', ({ roomId }) => {
    const clients = io.sockets.adapter.rooms.get(roomId);
    
    if (!clients || clients.size === 0) {
      socket.emit('error', { message: 'Invalid room code.' });
      return;
    }

    socket.join(roomId);
    console.log(`${socket.id} joined room ${roomId}`);

    socket.to(roomId).emit('peer-joined', { peerId: socket.id });
    socket.emit('room-joined', { roomId });
  });

  socket.on('signal', ({ targetId, signalData }) => {
    io.to(targetId).emit('signal', { senderId: socket.id, signalData });
  });

  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit('peer-disconnected', { peerId: socket.id });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server listening on port ${PORT}`);
});
