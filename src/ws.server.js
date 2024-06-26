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

// 设置最大用户数
const maxUsers = 4;

// 监听连接事件
io.on('connection', socket => {
  console.log('A new user connected.:', socket.id);

  // 加入房间
  socket.on('join', roomId => {
    const clients = io.sockets.adapter.rooms.get(roomId)
    console.log('clients:', clients);
    console.log('socket.rooms:', socket.rooms);
    if(!clients || (clients && clients.size < maxUsers)) {
      socket.join(roomId);
      // 通知房间内的其他客户端
      socket.to(roomId).emit('message', {
        type: 'join',
        payload: {
          roomId,
          socketId: socket.id
        }
      });
    }else {
      // 向指定的客户端发送错误消息,这其实就是指定自己
      io.to(socket.id).emit('message', {
        type: 'error',
        payload: {
          error: '房间已满'
        }
      })
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

  // 监听连接断开事件 https://socket.io/zh-CN/docs/v4/server-socket-instance/#disconnecting
  socket.on('disconnecting', () => {
    console.log('socket.rooms:',socket.rooms)
    // 通知房间内的其他客户端
    // socket.rooms表示当前所在的所有房间: https://socket.io/zh-CN/docs/v4/server-socket-instance/#socketrooms
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit("message", {
          type: 'leave',
          payload: {
            socketId: socket.id
          }
        });
      }
    }
  });
});

// 启动服务器
const PORT = process.env.PORT || 5998;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
