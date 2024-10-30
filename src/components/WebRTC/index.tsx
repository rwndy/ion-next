import { useRef, useState, useEffect } from 'react';
const wsEndpoint = 'wss://sfu.haryadi.my.id/ws';

const WebRTC = () => {
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const connectWebSocket = () => {
            wsRef.current = new WebSocket(wsEndpoint);

            wsRef.current.onopen = () => {
                console.log('Connected to WebSocket');
                setIsConnected(true);
            };

            wsRef.current.onmessage = async (message) => {
                const data = JSON.parse(message.data);
                if (data.type === 'offer') {
                    await handleOffer(data.offer);
                } else if (data.type === 'answer') {
                    await handleAnswer(data.answer);
                } else if (data.type === 'candidate') {
                    await handleCandidate(data.candidate);
                }
            };

            wsRef.current.onclose = () => {
                console.log('WebSocket connection closed');
                setIsConnected(false);
                // Try to reconnect after 1 second
                setTimeout(connectWebSocket, 1000);
            };
        };

        connectWebSocket();

        return () => {
            wsRef.current?.close();
        };
    }, []);

    const initializePeerConnection = () => {
        const peerConnection = new RTCPeerConnection();
        peerConnection.onicecandidate = (event) => {
            // Check if WebSocket is open before sending
            if (
                event.candidate &&
                wsRef.current?.readyState === WebSocket.OPEN
            ) {
                wsRef.current.send(
                    JSON.stringify({
                        type: 'candidate',
                        candidate: event.candidate,
                    })
                );
            }
        };
        peerConnection.ontrack = (event) => {
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
        };
        peerConnectionRef.current = peerConnection;
    };

    const startCall = async () => {
        initializePeerConnection();

        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
        });
        stream.getTracks().forEach((track) => {
            peerConnectionRef.current?.addTrack(track, stream);
        });

        if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
        }

        const offer = await peerConnectionRef.current?.createOffer();
        await peerConnectionRef.current?.setLocalDescription(offer!);

        // Send offer if WebSocket is open
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'offer', offer }));
        }
    };

    const handleOffer = async (offer: RTCSessionDescriptionInit) => {
        initializePeerConnection();

        await peerConnectionRef.current?.setRemoteDescription(
            new RTCSessionDescription(offer)
        );
        const answer = await peerConnectionRef.current?.createAnswer();
        await peerConnectionRef.current?.setLocalDescription(answer!);

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'answer', answer }));
        }
    };

    const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
        await peerConnectionRef.current?.setRemoteDescription(
            new RTCSessionDescription(answer)
        );
    };

    const handleCandidate = async (candidate: RTCIceCandidateInit) => {
        await peerConnectionRef.current?.addIceCandidate(
            new RTCIceCandidate(candidate)
        );
    };

    return (
        <div>
            <h1>WebRTC Peer Connection</h1>
            <button onClick={startCall} disabled={!isConnected}>
                Start Call
            </button>
            <div>
                <video ref={localVideoRef} autoPlay muted />
                <video ref={remoteVideoRef} autoPlay />
            </div>
        </div>
    );
};

export default WebRTC;
