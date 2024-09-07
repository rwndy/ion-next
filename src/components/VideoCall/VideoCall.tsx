// components/VideoCall.tsx
import { useState, useEffect, useRef } from 'react';

const signalingServer = 'wss://sfu.haryadi.my.id/ws';

const VideoCall = () => {
  const [isCallStarted, setIsCallStarted] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Initialize WebSocket connection
    websocketRef.current = new WebSocket(signalingServer);
    websocketRef.current.onopen = () => console.log('WebSocket connected');
    websocketRef.current.onmessage = handleSignalingMessage;
    websocketRef.current.onerror = (error) => console.error('WebSocket error:', error);
    websocketRef.current.onclose = () => console.log('WebSocket closed');

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, []);

  const createPeerConnection = () => {
    const configuration: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ]
    };

    const peerConnection = new RTCPeerConnection(configuration);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignalingMessage({ type: 'ice-candidate', candidate: event.candidate });
      }
    };

    peerConnection.ontrack = (event) => {
      console.log('Received remote track:', event.streams[0]);
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', peerConnection.iceConnectionState);
    };

    return peerConnection;
  };

  const startCall = async () => {
    try {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      peerConnectionRef.current = createPeerConnection();

      localStreamRef.current.getTracks().forEach((track) => {
        if (peerConnectionRef.current && localStreamRef.current) {
          peerConnectionRef.current.addTrack(track, localStreamRef.current);
        }
      });

      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      sendSignalingMessage({ type: 'offer', offer });

      setIsCallStarted(true);
    } catch (error) {
      console.error('Error starting the call:', error);
    }
  };

  const handleSignalingMessage = async (event: MessageEvent) => {
    const message = JSON.parse(event.data);
    console.log('Received signaling message:', message);

    switch (message.type) {
      case 'offer':
        await handleOffer(message.offer);
        break;
      case 'answer':
        await handleAnswer(message.answer);
        break;
      case 'ice-candidate':
        await handleNewICECandidate(message.candidate);
        break;
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    try {
      if (!peerConnectionRef.current) {
        peerConnectionRef.current = createPeerConnection();
      }

      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));

      localStreamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      localStreamRef.current.getTracks().forEach((track) => {
        if (peerConnectionRef.current && localStreamRef.current) {
          peerConnectionRef.current.addTrack(track, localStreamRef.current);
        }
      });

      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      sendSignalingMessage({ type: 'answer', answer });
      setIsCallStarted(true);
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const handleNewICECandidate = async (candidate: RTCIceCandidateInit) => {
    try {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  };

  const sendSignalingMessage = (message: any) => {
    if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify(message));
    }
  };

  const endCall = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setIsCallStarted(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">Local Video</h2>
          <video ref={localVideoRef} autoPlay muted playsInline className="w-full bg-black" />
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-2">Remote Video</h2>
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full bg-black" />
        </div>
      </div>
      <div className="flex justify-center space-x-4">
        <button
          onClick={startCall}
          disabled={isCallStarted}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400"
        >
          Start Call
        </button>
        <button
          onClick={endCall}
          disabled={!isCallStarted}
          className="px-4 py-2 bg-red-500 text-white rounded disabled:bg-gray-400"
        >
          End Call
        </button>
      </div>
    </div>
  );
};

export default VideoCall;