'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import './PremiumCursor.css'

interface CursorState {
  type: 'default' | 'pointer' | 'text' | 'loading' | 'disabled'
  scale: number
  opacity: number
}

export function PremiumCursor() {
  const [isVisible, setIsVisible] = useState(false)
  const [cursorState, setCursorState] = useState<CursorState>({
    type: 'default',
    scale: 1,
    opacity: 1
  })
  
  // Raw mouse position
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  
  // Ultra-smooth spring configuration for premium feel
  const springConfig = {
    damping: 25,
    stiffness: 350,
    mass: 0.5,
    restDelta: 0.001
  }
  
  // Smooth cursor position with spring physics
  const cursorX = useSpring(mouseX, springConfig)
  const cursorY = useSpring(mouseY, springConfig)
  
  // Refs for performance
  const requestRef = useRef<number>()
  const previousTimeRef = useRef<number>()
  const targetX = useRef(0)
  const targetY = useRef(0)
  
  useEffect(() => {
    // Only show on non-touch devices
    if (!window.matchMedia('(pointer: fine)').matches) return

    // High-performance mouse tracking with RAF
    const updateMousePosition = (time: number) => {
      if (previousTimeRef.current !== undefined) {
        // Update motion values only if position changed
        if (Math.abs(targetX.current - mouseX.get()) > 0.1 || 
            Math.abs(targetY.current - mouseY.get()) > 0.1) {
          mouseX.set(targetX.current)
          mouseY.set(targetY.current)
        }
      }
      
      previousTimeRef.current = time
      requestRef.current = requestAnimationFrame(updateMousePosition)
    }
    
    const handleMouseMove = (e: MouseEvent) => {
      targetX.current = e.clientX
      targetY.current = e.clientY
      
      // Analyze target element for cursor state
      const target = e.target as HTMLElement
      const computedStyle = window.getComputedStyle(target)
      const cursorStyle = computedStyle.cursor
      
      // Determine cursor type
      const isClickable = 
        target.tagName === 'A' ||
        target.tagName === 'BUTTON' ||
        target.onclick !== null ||
        target.closest('a') !== null ||
        target.closest('button') !== null ||
        target.closest('[role="button"]') !== null ||
        cursorStyle === 'pointer'

      const isTextInput = 
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        cursorStyle === 'text'
        
      const isDisabled = 
        target.getAttribute('disabled') !== null ||
        cursorStyle === 'not-allowed'

      // Update cursor state
      if (isDisabled) {
        setCursorState({ type: 'disabled', scale: 0.8, opacity: 0.5 })
      } else if (isTextInput) {
        setCursorState({ type: 'text', scale: 0.8, opacity: 1 })
      } else if (isClickable) {
        setCursorState({ type: 'pointer', scale: 1.2, opacity: 1 })
      } else {
        setCursorState({ type: 'default', scale: 1, opacity: 1 })
      }
    }

    const handleMouseEnter = () => {
      setIsVisible(true)
      document.body.style.cursor = 'none'
    }

    const handleMouseLeave = () => {
      setIsVisible(false)
    }

    const handleMouseDown = () => {
      setCursorState(prev => ({ ...prev, scale: prev.scale * 0.8 }))
    }

    const handleMouseUp = () => {
      setCursorState(prev => ({ 
        ...prev, 
        scale: prev.type === 'pointer' ? 1.2 : 1 
      }))
    }

    // Start animation loop
    requestRef.current = requestAnimationFrame(updateMousePosition)
    
    // Set initial state
    document.body.style.cursor = 'none'
    setIsVisible(true)

    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseenter', handleMouseEnter)
    document.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
      }
      document.body.style.cursor = 'auto'
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseenter', handleMouseEnter)
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [mouseX, mouseY])

  // Don't render on touch devices
  if (typeof window !== 'undefined' && !window.matchMedia('(pointer: fine)').matches) {
    return null
  }

  const variants = {
    default: {
      width: 32,
      height: 32,
      backgroundColor: 'rgba(147, 51, 234, 0.1)',
      border: '2px solid rgba(147, 51, 234, 0.8)',
    },
    pointer: {
      width: 40,
      height: 40,
      backgroundColor: 'rgba(147, 51, 234, 0.15)',
      border: '2px solid rgba(147, 51, 234, 1)',
    },
    text: {
      width: 3,
      height: 20,
      backgroundColor: 'rgba(147, 51, 234, 1)',
      border: 'none',
      borderRadius: '1.5px',
    },
    disabled: {
      width: 32,
      height: 32,
      backgroundColor: 'rgba(156, 163, 175, 0.1)',
      border: '2px solid rgba(156, 163, 175, 0.5)',
    }
  }

  return (
    <div
      className="premium-cursor-container"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9999999,
      }}
    >
      {/* Main cursor */}
      <motion.div
        className="premium-cursor-main"
        style={{
          position: 'absolute',
          x: cursorX,
          y: cursorY,
          translateX: '-50%',
          translateY: '-50%',
        }}
        animate={cursorState.type}
        variants={variants}
        transition={{
          type: 'spring',
          damping: 30,
          stiffness: 500,
          mass: 0.2,
        }}
        initial={false}
      >
        {/* Inner dot for better visibility */}
        <motion.div
          className="premium-cursor-dot"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 4,
            height: 4,
            borderRadius: '50%',
            backgroundColor: 'rgb(147, 51, 234)',
            transform: 'translate(-50%, -50%)',
          }}
          animate={{
            scale: cursorState.type === 'text' ? 0 : 1,
            opacity: isVisible ? 1 : 0,
          }}
          transition={{
            duration: 0.15,
            ease: 'easeOut',
          }}
        />
      </motion.div>

      {/* Trailing effect for premium feel */}
      <motion.div
        className="premium-cursor-trail"
        style={{
          position: 'absolute',
          x: cursorX,
          y: cursorY,
          width: 50,
          height: 50,
          translateX: '-50%',
          translateY: '-50%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(147, 51, 234, 0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
        animate={{
          scale: cursorState.scale * 1.5,
          opacity: isVisible && cursorState.type === 'pointer' ? 0.6 : 0,
        }}
        transition={{
          type: 'spring',
          damping: 20,
          stiffness: 200,
          mass: 0.1,
        }}
      />
    </div>
  )
}