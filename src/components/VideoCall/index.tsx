import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';

interface WebSocketMessage {
  type: 'offer' | 'answer' | 'candidate';
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

const VideoCall: React.FC = () => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);

  const handleTrack = useCallback((event: RTCTrackEvent) => {
    if (remoteVideoRef.current && event.streams[0]) {
      remoteVideoRef.current.srcObject = event.streams[0];
    }
  }, []);

  useEffect(() => {
    const initWebRTC = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const peerConnection = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });

        peerConnection.ontrack = handleTrack;

        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream);
        });

        peerConnectionRef.current = peerConnection;

        const ws = new WebSocket('wss://sfu.haryadi.my.id/ws');
        ws.onmessage = handleWebSocketMessage;
        websocketRef.current = ws;

      } catch (error) {
        console.error('Error initializing WebRTC:', error);
      }
    };

    initWebRTC();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, [handleTrack]);

  const handleWebSocketMessage = async (event: MessageEvent) => {
    const message: WebSocketMessage = JSON.parse(event.data);
    const peerConnection = peerConnectionRef.current;
    if (!peerConnection) return;

    switch (message.type) {
      case 'offer':
        if (message.offer) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          websocketRef.current?.send(JSON.stringify({ type: 'answer', answer }));
        }
        break;
      case 'answer':
        if (message.answer) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
        }
        break;
      case 'candidate':
        if (message.candidate) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
        }
        break;
    }
  };

  const toggleAudio = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsAudioMuted(prev => !prev);
    }
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(prev => !prev);
    }
  }, [localStream]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-4xl">
        <h1 className="text-2xl font-bold mb-4 text-center">WebRTC Video Chat</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-auto rounded-lg bg-black"
            />
            <p className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded">You</p>
          </div>
          <div className="relative">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-auto rounded-lg bg-black"
            />
            <p className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded">Friend</p>
          </div>
        </div>
        <div className="flex justify-center mt-4 space-x-4">
          <button
            onClick={toggleAudio}
            className={`p-2 rounded-full ${isAudioMuted ? 'bg-red-500' : 'bg-green-500'}`}
          >
            {isAudioMuted ? <MicOff className="text-white" /> : <Mic className="text-white" />}
          </button>
          <button
            onClick={toggleVideo}
            className={`p-2 rounded-full ${isVideoOff ? 'bg-red-500' : 'bg-green-500'}`}
          >
            {isVideoOff ? <VideoOff className="text-white" /> : <Video className="text-white" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;