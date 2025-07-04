import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';

interface TelemedicineRoomProps {
  roomUrl: string;
  patientName: string;
  doctorName: string;
  appointmentId: string;
  onEnd: () => void;
}

export const TelemedicineRoom: React.FC<TelemedicineRoomProps> = ({
  roomUrl,
  patientName,
  doctorName,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  appointmentId, // Will be used for tracking/logging in future updates
  onEnd
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Start duration timer
    intervalRef.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            <span className="text-white font-medium">Telemedicine Session</span>
          </div>
          <div className="text-gray-300 text-sm">
            {doctorName} with {patientName}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white font-mono">{formatDuration(duration)}</span>
          <button
            onClick={onEnd}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2"
          >
            <Icon icon="solar:phone-bold-duotone" className="w-5 h-5" />
            End Call
          </button>
        </div>
      </div>

      {/* Video Container - Jitsi iframe */}
      <div className="flex-1 relative">
        <iframe
          src={roomUrl}
          className="w-full h-full"
          allow="camera; microphone; display-capture; autoplay; clipboard-write; clipboard-read"
          allowFullScreen
          onLoad={() => setIsConnected(true)}
        />
        
        {!isConnected && (
          <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
            <div className="text-center">
              <Icon icon="solar:refresh-circle-bold-duotone" className="w-12 h-12 text-gray-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-300">Connecting to video room...</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="bg-gray-800 p-4">
        <div className="flex items-center justify-center gap-4">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsMuted(!isMuted)}
            className={`p-4 rounded-full ${isMuted ? 'bg-red-600' : 'bg-gray-700'} hover:bg-opacity-80`}
          >
            <Icon 
              icon={isMuted ? "solar:microphone-slash-bold-duotone" : "solar:microphone-bold-duotone"} 
              className="w-6 h-6 text-white" 
            />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsVideoOff(!isVideoOff)}
            className={`p-4 rounded-full ${isVideoOff ? 'bg-red-600' : 'bg-gray-700'} hover:bg-opacity-80`}
          >
            <Icon 
              icon={isVideoOff ? "solar:videocamera-slash-bold-duotone" : "solar:videocamera-bold-duotone"} 
              className="w-6 h-6 text-white" 
            />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-4 rounded-full bg-gray-700 hover:bg-opacity-80"
          >
            <Icon icon="solar:chat-round-dots-bold-duotone" className="w-6 h-6 text-white" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-4 rounded-full bg-gray-700 hover:bg-opacity-80"
          >
            <Icon icon="solar:share-bold-duotone" className="w-6 h-6 text-white" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-4 rounded-full bg-gray-700 hover:bg-opacity-80"
          >
            <Icon icon="solar:record-circle-bold-duotone" className="w-6 h-6 text-white" />
          </motion.button>
        </div>
      </div>
    </div>
  );
};