<template>
  <div>
    <h1>1 v 1</h1>
    <button @click="startVideoCall">邀请好友</button>
    <div class="video-container">
      <div class="video-player">
        <video ref="localPlayer" autoplay></video>
      </div>
      <div class="video-player">
        <video ref="remotePlayer" autoplay></video>
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
      peerConnection: null,
      localStream: null
    }
  },
  async mounted() {
    this.getLocalStream()
    let roomId = this.$route.query.roomId
    if(!roomId) {
      roomId = Math.random().toString(36).substring(7)
      this.$router.replace({query: {roomId}})
    } 
    ws.emit('join', roomId)

    const peerConnection = await this.createPeerConnection()
    ws.on('message', async (message) => {
      console.error('收到消息', message)
      switch(message.type) {
        case 'join': 
          console.error('接到join通知')
          const offer = await peerConnection.createOffer()
          await peerConnection.setLocalDescription(offer)
          ws.emit('message', message.payload.socketId, {type: 'offer', payload: {offer}})
          break
        case 'offer':
          console.error('接到offer通知')
          const sdpOffer = new RTCSessionDescription(message.payload.offer)
          await peerConnection.setRemoteDescription(sdpOffer)
          const answer = await peerConnection.createAnswer()
          await peerConnection.setLocalDescription(answer)
          ws.emit('message', message.payload.socketId, {type: 'answer', payload: {answer}})
          break
        case 'answer':
          console.error('接到answer通知')
          const sdpAnswer = new RTCSessionDescription(message.payload.answer)
          await peerConnection.setRemoteDescription(sdpAnswer)
          break
      }
    })
  },
  methods: {
    async getLocalStream () {
      if(this.localStream) return  this.localStream
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      this.$refs.localPlayer.srcObject = stream

      this.localStream = stream
      return stream
    },  
    // 创建对等链接
    async createPeerConnection() {
      const configuration = {
        iceServers: [
          {urls: 'stun:stun.l.google.com:19302'}, 
          {urls: 'turn:turnserver.com', username: 'user', credential: 'pass'}
        ]
      }
      const peerConnection = new RTCPeerConnection(configuration);

      const localStream = await this.getLocalStream()
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream)
      })

      // 处理远程媒体流
      peerConnection.ontrack = event => {
        const remoteStream = event.streams[0];
        this.$refs.remotePlayer.srcObject = remoteStream
      }
      // 处理ICE候选
      peerConnection.onicecandidate = event => {
        if (event.candidate) {
          // 1.将 ICE 候选发送给 对方
          // ws.send('sendICECandidate', event.candidate)
          // 2.同时监听对方 ICE 候选
          // 示例：ws.on('receiveICECandidate', (candidate) => this.receiveICECandidate(candidate))
        }
      }
      return peerConnection
    },
    async startVideoCall() {
      const url = window.location.href
      navigator.clipboard.writeText(url)
      .then(() => {
        alert('分享链接已复制到剪贴板,快去发给好友试试吧!')
      })
      .catch((error) => {
        alert('无法复制到剪贴板,请你手动复制吧!')
      })
    },
    async receiveSDPAnswer(sdpAnswer) {
      console.error('1p: 我收到answer了!', sdpAnswer)
      await this.peerConnection.setRemoteDescription(sdpAnswer)
    },
    async receiveSDPOffer(params) {
      console.error('2p: 我收到offer了!', params)
      await this.peerConnection.setRemoteDescription(params.offer)
      const answer = await this.peerConnection.createAnswer()
      await this.peerConnection.setLocalDescription(answer)
      ws.emit('sendSDPAnswer', answer)
    },
    async receiveICECandidate(candidate) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
    }
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
