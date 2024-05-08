import { io } from 'socket.io-client';
const ws = io('ws://localhost:5998');
// 直接使用new WebSocket('ws://localhost:5998') 连接不上,无奈只能用第三方库
// socket.io如果发现WebSocket连接不可用,会自动降级为轮询(polling)
// 更多详见: https://socket.io/
export default ws;