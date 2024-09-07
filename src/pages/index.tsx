// pages/index.tsx
import { useState, useEffect, useRef } from 'react';
import VideoCall from '../components/VideoCall/VideoCall';

const Home = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">WebRTC Video Call Example</h1>
      <VideoCall />
    </div>
  );
};

export default Home;