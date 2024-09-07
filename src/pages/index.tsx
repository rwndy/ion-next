import { useEffect, useRef, useState } from 'react';

const signalingServer = 'wss://sfu.haryadi.my.id/ws';

const Home = () => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [webSocket, setWebSocket] = useState<WebSocket | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);

  useEffect(() => {
    const ws = new WebSocket(signalingServer);
    ws.onopen = () => console.log('WebSocket connected');
    ws.onmessage = handleSignalingData;
    setWebSocket(ws);

    return () => {
      endCall();
      ws.close();
    };
  }, []);

  const handleSignalingData = async (message: MessageEvent) => {
    const data = JSON.parse(message.data);

    switch (data.type) {
      case 'offer':
        await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await peerConnection.current?.createAnswer();
        await peerConnection.current?.setLocalDescription(answer!);
        webSocket?.send(JSON.stringify({ type: 'answer', data: answer }));
        break;
      case 'answer':
        await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(data));
        break;
      case 'candidate':
        await peerConnection.current?.addIceCandidate(new RTCIceCandidate(data.candidate));
        break;
      default:
        break;
    }
  };

  const startCall = async () => {
    peerConnection.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        webSocket?.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
      }
    };

    peerConnection.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    localStream.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStream.current.getTracks().forEach((track) => peerConnection.current?.addTrack(track, localStream.current!));
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream.current;
    }

    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    webSocket?.send(JSON.stringify({ type: 'offer', data: offer }));
  };

  const endCall = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => track.stop());
      localStream.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    if (webSocket) {
      webSocket.send(JSON.stringify({ type: 'endCall' }));
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white shadow-lg rounded-lg p-6 w-full max-w-4xl">
        <h1 className="text-2xl font-semibold text-center mb-6 text-gray-800">WebRTC Video Call</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <video ref={localVideoRef} autoPlay muted className="w-full h-64 bg-black rounded-lg" />
          <video ref={remoteVideoRef} autoPlay className="w-full h-64 bg-black rounded-lg" />
        </div>
        <div className="flex justify-center space-x-4">
          <button
            onClick={startCall}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition duration-300"
          >
            Start Call
          </button>
          <button
            onClick={endCall}
            className="px-6 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition duration-300"
          >
            End Call
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;
