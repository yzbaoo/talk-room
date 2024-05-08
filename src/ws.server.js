import http from 'http';
import { Server as socketIoServer } from 'socket.io';

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/plain',
});
  res.end('Hello World\n');
});

// 创建 Socket.IO 服务器
const io = new socketIoServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const _rooms = new Map();

const maxUsers = 2;

// 监听连接事件
io.on('connection', socket => {
  console.log('A new user connected.:', socket.id);

  // 加入房间
  socket.on('join', roomId => {
    const clients = io.sockets.adapter.rooms.get(roomId)
    if(!clients || (clients && clients.size <= maxUsers)) {
      socket.join(roomId);
      // 通知房间内的其他客户端
      socket.to(roomId).emit('message', {
        type: 'join',
        payload: {
          roomId,
          socketId: socket.id
        }
      });
    }
  })

  // 转发客户端消息
  socket.on('message', (socketId, message) => {
    if (socketId) {
      // 发送消息到指定客户端
      message.payload.socketId = socket.id;
      io.to(socketId).emit('message', message)
    }
  })

  // // 离开房间
  // socket.on('leaveRoom', params => {
  //   socket.leave(params.shareCode);
  // })

  // // 处理offer
  // socket.on('sendSDPOffer', message => {

  //   io.emit('receiveSDPOffer', message);
  // });

  // // 处理answer
  // socket.on('sendSDPAnswer', message => {
  //   io.emit('receiveSDPAnswer', message);
  // })

  // 监听连接断开事件
  socket.on('disconnect', () => {
    console.log('User disconnected.:', socket.id);
  });
});

// 启动服务器
const PORT = process.env.PORT || 5998;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
