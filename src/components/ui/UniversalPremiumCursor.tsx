'use client'

import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion'

interface Ripple {
  id: number
  x: number
  y: number
}

export function UniversalPremiumCursor() {
  const [isPointer, setIsPointer] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [ripples, setRipples] = useState<Ripple[]>([])
  
  const mouseX = useMotionValue(-100)
  const mouseY = useMotionValue(-100)
  
  // Smooth spring for cursor movement
  const springConfig = { damping: 30, stiffness: 700 }
  const cursorX = useSpring(mouseX, springConfig)
  const cursorY = useSpring(mouseY, springConfig)
  
  // Slower spring for ring
  const ringSpringConfig = { damping: 25, stiffness: 200 }
  const ringX = useSpring(mouseX, ringSpringConfig)
  const ringY = useSpring(mouseY, ringSpringConfig)

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return

    const moveCursor = (e: MouseEvent) => {
      mouseX.set(e.clientX)
      mouseY.set(e.clientY)
      
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

    const handleClick = (e: MouseEvent) => {
      const newRipple: Ripple = {
        id: Date.now(),
        x: e.clientX,
        y: e.clientY
      }
      setRipples(prev => [...prev, newRipple])
      setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== newRipple.id))
      }, 1000)
    }

    const handleMouseEnter = () => setIsVisible(true)
    const handleMouseLeave = () => setIsVisible(false)

    // Force cursor to be visible on the entire document
    const style = document.createElement('style')
    style.textContent = `
      *, *::before, *::after {
        cursor: none !important;
      }
      html, body {
        cursor: none !important;
      }
    `
    document.head.appendChild(style)
    
    window.addEventListener('mousemove', moveCursor)
    window.addEventListener('click', handleClick)
    document.addEventListener('mouseenter', handleMouseEnter)
    document.addEventListener('mouseleave', handleMouseLeave)
    
    return () => {
      window.removeEventListener('mousemove', moveCursor)
      window.removeEventListener('click', handleClick)
      document.removeEventListener('mouseenter', handleMouseEnter)
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.head.removeChild(style)
    }
  }, [mouseX, mouseY])

  if (typeof window !== 'undefined' && !window.matchMedia('(pointer: fine)').matches) {
    return null
  }

  return (
    <div 
      className="pointer-events-none"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 2147483647,
        isolation: 'isolate',
      }}
    >
      {/* Ripple effects */}
      <AnimatePresence>
        {ripples.map(ripple => (
          <motion.div
            key={ripple.id}
            initial={{ scale: 0, opacity: 0.8 }}
            animate={{ scale: 3, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              left: ripple.x,
              top: ripple.y,
              width: 20,
              height: 20,
              marginLeft: -10,
              marginTop: -10,
              borderRadius: '50%',
              border: '2px solid rgb(147, 51, 234)',
              pointerEvents: 'none',
            }}
          />
        ))}
      </AnimatePresence>

      {/* Outer ring - lags behind */}
      <motion.div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          x: ringX,
          y: ringY,
          translateX: '-50%',
          translateY: '-50%',
        }}
        animate={{
          opacity: isVisible ? 0.8 : 0,
        }}
      >
        <motion.div
          animate={{
            scale: isPointer ? 1.5 : 1,
            borderColor: isPointer ? 'rgb(168, 85, 247)' : 'rgb(147, 51, 234)',
          }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 20 
          }}
          style={{
            width: 40,
            height: 40,
            border: '2px solid rgb(147, 51, 234)',
            borderRadius: '50%',
          }}
        />
      </motion.div>
      
      {/* Inner dot - moves instantly */}
      <motion.div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          x: cursorX,
          y: cursorY,
          translateX: '-50%',
          translateY: '-50%',
        }}
        animate={{
          opacity: isVisible ? 1 : 0,
        }}
      >
        <motion.div
          animate={{
            scale: isPointer ? 1.2 : 1,
            backgroundColor: isPointer ? 'rgb(168, 85, 247)' : 'rgb(147, 51, 234)',
          }}
          transition={{ 
            type: "spring", 
            stiffness: 400, 
            damping: 25 
          }}
          style={{
            width: 6,
            height: 6,
            backgroundColor: 'rgb(147, 51, 234)',
            borderRadius: '50%',
            boxShadow: '0 0 10px rgba(147, 51, 234, 0.6)',
          }}
        />
      </motion.div>
    </div>
  )
}