'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

interface VideoBackgroundProps {
  className?: string
}

export function VideoBackground({ className = '' }: VideoBackgroundProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isVideoLoaded, setIsVideoLoaded] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Force video to play
    const playVideo = async () => {
      try {
        video.muted = true
        video.playsInline = true
        await video.play()
      } catch (error) {
        console.log('Video autoplay failed, user interaction may be required')
      }
    }

    video.addEventListener('loadeddata', () => {
      setIsVideoLoaded(true)
      playVideo()
    })

    // Try to play immediately if already loaded
    if (video.readyState >= 3) {
      setIsVideoLoaded(true)
      playVideo()
    }

    return () => {
      video.removeEventListener('loadeddata', () => {})
    }
  }, [])

  return (
    <div className={`video-background-wrapper ${className}`}>
      {/* Video Element */}
      <video
        ref={videoRef}
        className="video-bg"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1920&q=80"
      >
        <source 
          src="https://videos.pexels.com/video-files/5721913/5721913-hd_1920_1080_25fps.mp4" 
          type="video/mp4" 
        />
        <source 
          src="https://cdn.pixabay.com/video/2022/08/06/127451-737041195_large.mp4" 
          type="video/mp4" 
        />
      </video>

      {/* Dark Overlay */}
      <div className="video-overlay" />

      {/* Fallback gradient while video loads */}
      <motion.div
        className="video-fallback"
        initial={{ opacity: 1 }}
        animate={{ opacity: isVideoLoaded ? 0 : 1 }}
        transition={{ duration: 1 }}
      />

      <style jsx>{`
        .video-background-wrapper {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          z-index: -1;
        }

        .video-bg {
          position: absolute;
          top: 50%;
          left: 50%;
          min-width: 100%;
          min-height: 100%;
          width: auto;
          height: auto;
          transform: translate(-50%, -50%) scale(1.1);
          object-fit: cover;
          z-index: -3;
        }

        .video-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            to bottom,
            rgba(0, 0, 0, 0.7) 0%,
            rgba(0, 0, 0, 0.5) 50%,
            rgba(0, 0, 0, 0.7) 100%
          );
          z-index: -2;
        }

        .video-fallback {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            135deg,
            #1e293b 0%,
            #334155 50%,
            #1e293b 100%
          );
          z-index: -2;
        }

        /* Ensure video plays on all devices */
        @media (max-width: 768px) {
          .video-bg {
            display: block !important;
          }
        }
      `}</style>
    </div>
  )
}