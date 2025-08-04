'use client'

import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

export function LaggedPremiumCursor() {
  const [isPointer, setIsPointer] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  
  // Raw mouse position for the dot (no lag)
  const mouseX = useMotionValue(-100)
  const mouseY = useMotionValue(-100)
  
  // Different spring configs for dot and ring
  // Dot - instant response
  const dotSpringConfig = { damping: 40, stiffness: 1000, mass: 0.1 }
  const dotX = useSpring(mouseX, dotSpringConfig)
  const dotY = useSpring(mouseY, dotSpringConfig)
  
  // Ring - smooth lag behind dot
  const ringSpringConfig = { damping: 25, stiffness: 200, mass: 0.8 }
  const ringX = useSpring(mouseX, ringSpringConfig)
  const ringY = useSpring(mouseY, ringSpringConfig)

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return

    const moveCursor = (e: MouseEvent) => {
      mouseX.set(e.clientX)
      mouseY.set(e.clientY)
      
      // Check if hovering over clickable element
      const target = e.target as HTMLElement
      const isClickable = 
        window.getComputedStyle(target).cursor === 'pointer' ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.closest('button') !== null ||
        target.closest('a') !== null ||
        target.closest('[role="button"]') !== null
        
      setIsPointer(isClickable)
    }

    const handleMouseEnter = () => setIsVisible(true)
    const handleMouseLeave = () => setIsVisible(false)

    // Hide default cursor
    document.body.style.cursor = 'none'
    
    // Add listeners
    window.addEventListener('mousemove', moveCursor)
    document.addEventListener('mouseenter', handleMouseEnter)
    document.addEventListener('mouseleave', handleMouseLeave)
    
    return () => {
      window.removeEventListener('mousemove', moveCursor)
      document.removeEventListener('mouseenter', handleMouseEnter)
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.body.style.cursor = 'auto'
    }
  }, [mouseX, mouseY])

  // Don't render on touch devices
  if (typeof window !== 'undefined' && !window.matchMedia('(pointer: fine)').matches) {
    return null
  }

  return (
    <>
      <style jsx global>{`
        * {
          cursor: none !important;
        }
      `}</style>
      
      {/* Outer ring - lags behind */}
      <motion.div
        className="pointer-events-none fixed"
        style={{
          left: 0,
          top: 0,
          x: ringX,
          y: ringY,
          translateX: '-50%',
          translateY: '-50%',
          zIndex: 2147483646,
        }}
        animate={{
          opacity: isVisible ? 1 : 0,
        }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          animate={{
            scale: isPointer ? 1.5 : 1,
            borderColor: isPointer ? 'rgb(168, 85, 247)' : 'rgb(147, 51, 234)',
          }}
          transition={{ 
            scale: { type: "spring", stiffness: 300, damping: 20 },
            borderColor: { duration: 0.2 }
          }}
          className="w-10 h-10 border-2 rounded-full"
          style={{
            borderColor: 'rgb(147, 51, 234)',
            opacity: 0.8,
          }}
        />
      </motion.div>
      
      {/* Inner dot - moves instantly */}
      <motion.div
        className="pointer-events-none fixed"
        style={{
          left: 0,
          top: 0,
          x: dotX,
          y: dotY,
          translateX: '-50%',
          translateY: '-50%',
          zIndex: 2147483647,
        }}
        animate={{
          opacity: isVisible ? 1 : 0,
        }}
        transition={{ duration: 0.1 }}
      >
        <motion.div
          animate={{
            scale: isPointer ? 1.2 : 1,
            backgroundColor: isPointer ? 'rgb(168, 85, 247)' : 'rgb(147, 51, 234)',
          }}
          transition={{ 
            scale: { type: "spring", stiffness: 400, damping: 25 },
            backgroundColor: { duration: 0.15 }
          }}
          className="w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor: 'rgb(147, 51, 234)',
            boxShadow: '0 0 8px rgba(147, 51, 234, 0.6)',
          }}
        />
      </motion.div>
    </>
  )
}