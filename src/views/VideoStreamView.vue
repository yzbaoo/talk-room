<!-- 以“房间”为主体,只要房间内>=1个用户,其他知道房间号的用户就可以加入房间,房间内的人可以相互通话。
房间内如果=0个用户,房间自动释放
房间人数可以自定义, 默认4人 -->
<template>
  <div>
    <button @click="handleClick">邀请好友</button>
    <div class="video-container">
      <div class="video-player">
        <video ref="localPlayer" autoplay></video>
      </div>
      <div class="remotes-container">
        <div v-for="(value, socketId) in remotes" :key="socketId" class="video-player">
          <div>用户:{{socketId}}</div>
          <video :ref="socketId" :id="socketId" autoplay></video>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
import ws from '../ws.client'
export default {
  name: 'VideoStreamView',
  data() {
    return {
      remotes: {}, // 远程所有客户端
      localStream: null
    }
  },
  // watch: {
  //   remotes: {
  //     handler(newVal, oldVal) {
  //       console.error("🚀 ~ remotes ~ newVal:", newVal)
  //       console.error("🚀 ~ remotes ~ oldVal:", oldVal)
  //     },
  //     deep: true
  //   }
  // },
  async mounted() {
    let roomId = this.$route.query.roomId
    if(!roomId) {
      roomId = Math.random().toString(36).substring(7)
      this.$router.replace({query: {roomId}})
    } 

    // 创建本地视频流
    this.createLocalStream()
    
    // 加入房间
    ws.emit('join', roomId)

    // 监听房间消息
    this.listenRoomMessage()
  },
  methods: {
    // 创建本地视频流
    async createLocalStream () {
      if(this.localStream) return  this.localStream
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      this.$refs.localPlayer.srcObject = stream

      this.localStream = stream
      return stream
    },  
    // 监听房间信息
    listenRoomMessage() {
      ws.on('message', async (message) => {
        console.error("🚀 ~ ws.on ~ message:", message)
        switch(message.type) {
          case 'join': {
            // 注意:只要检测到有人加入,房间内的其他人就要创建一个点对点连接,也就是new RTCPeerConnection()
            const peerConnection = await this.createPeerConnection(message.payload.socketId)
            const offer = await peerConnection.createOffer()
            await peerConnection.setLocalDescription(offer)
            ws.emit('message', message.payload.socketId, {type: 'offer', payload: {offer}})
            break
          }
          case 'offer': {
            const peerConnection = await this.createPeerConnection(message.payload.socketId)
            const sdpOffer = new RTCSessionDescription(message.payload.offer)
            await peerConnection.setRemoteDescription(sdpOffer)
            const answer = await peerConnection.createAnswer()
            await peerConnection.setLocalDescription(answer)
            ws.emit('message', message.payload.socketId, {type: 'answer', payload: {answer}})
            break
          }
          case 'answer': {
            // 这其实取的是缓存中的 peerConnection
            const peerConnection = this.remotes[message.payload.socketId].pc
            const sdpAnswer = new RTCSessionDescription(message.payload.answer)
            await peerConnection.setRemoteDescription(sdpAnswer)
            break
          }
          case 'candidate': {
            const peerConnection = this.remotes[message.payload.socketId].pc
            await peerConnection.addIceCandidate(new RTCIceCandidate(message.payload.candidate))
            break
          }
          case 'error': {
            alert (message.payload.error)
            break
          }
        }
      })
    },
    // 创建对等链接
    async createPeerConnection(socketId) {
      if(this.remotes[socketId]?.pc) return this.remotes[socketId].pc

      const configuration = {
        iceServers: [
          {urls: 'stun:stun.l.google.com:19302'}, 
          {urls: 'turn:turnserver.com', username: 'user', credential: 'pass'}
        ]
      }
      const peerConnection = new RTCPeerConnection(configuration);

      const localStream = await this.createLocalStream()
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream)
      })

      // 处理远程媒体流
      peerConnection.ontrack = event => {
        const remoteStream = event.streams[0];
        console.error('this.$refs:', this.$refs)
        this.$refs[socketId][0].srcObject = remoteStream
      }
      // 处理ICE候选
      peerConnection.onicecandidate = event => {
        if (event.candidate) {
          // 1.将 ICE 候选发送给 对方
          ws.emit('message',socketId, {type: 'candidate', payload: {candidate: event.candidate}})
          // 2.同时监听对方 ICE 候选 统一放到listenRoomMessage中做这个事了
          // 示例：ws.on('receiveICECandidate', (candidate) => this.receiveICECandidate(candidate))
        }
      }
      this.remotes[socketId] = {
        pc: peerConnection
      }
      return peerConnection
    },
    // 点击邀请
    async handleClick() {
      const url = window.location.href
      navigator.clipboard.writeText(url)
      .then(() => {
        alert('分享链接已复制到剪贴板,快去发给好友试试吧!')
      })
      .catch((error) => {
        alert('无法复制到剪贴板,请你手动复制吧!')
      })
    },
  }

};
  </script>

  <style>
  .video-container {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
  }
  .video-player {
    flex: 1;
    object-fit: cover;
  }
  </style>
