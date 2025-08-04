'use client'

import { useEffect, useState } from 'react'
import { motion, useSpring, useMotionValue, AnimatePresence } from 'framer-motion'
import './CustomCursor.css'

export function CustomCursor() {
  const [isPointer, setIsPointer] = useState(false)
  const [isText, setIsText] = useState(false)
  const [isDown, setIsDown] = useState(false)
  const [cursorVariant, setCursorVariant] = useState('default')
  const [isVisible, setIsVisible] = useState(false)
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([])

  // Smooth spring physics
  const springConfig = { damping: 30, stiffness: 700, mass: 0.5 }
  const cursorX = useMotionValue(0)
  const cursorY = useMotionValue(0)
  const cursorXSpring = useSpring(cursorX, springConfig)
  const cursorYSpring = useSpring(cursorY, springConfig)


  useEffect(() => {
    // Only show on non-touch devices
    if (!window.matchMedia('(pointer: fine)').matches) return

    const handleMouseMove = (e: MouseEvent) => {
      // Update cursor position
      cursorX.set(e.clientX)
      cursorY.set(e.clientY)

      // Check element type
      const target = e.target as HTMLElement
      const computedStyle = window.getComputedStyle(target)
      const cursorStyle = computedStyle.cursor
      
      const isClickable = 
        target.tagName === 'A' ||
        target.tagName === 'BUTTON' ||
        target.onclick !== null ||
        target.closest('a') !== null ||
        target.closest('button') !== null ||
        target.closest('[role="button"]') !== null ||
        target.getAttribute('data-cursor') === 'pointer' ||
        cursorStyle === 'pointer'

      const isTextInput = 
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        cursorStyle === 'text'

      setIsPointer(isClickable)
      setIsText(isTextInput)

      // Handle custom cursor variants
      const customVariant = target.getAttribute('data-cursor')
      if (customVariant) {
        setCursorVariant(customVariant)
      } else {
        setCursorVariant('default')
      }
    }

    const handleMouseDown = (e: MouseEvent) => {
      setIsDown(true)
      
      // Create ripple effect
      const newRipple = { x: e.clientX, y: e.clientY, id: Date.now() }
      setRipples(prev => [...prev, newRipple])
      
      // Clean up old ripples
      setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== newRipple.id))
      }, 1000)
    }

    const handleMouseUp = () => {
      setIsDown(false)
    }

    const handleMouseEnter = () => {
      setIsVisible(true)
      document.body.style.cursor = 'none'
    }

    const handleMouseLeave = () => {
      setIsVisible(false)
    }

    // Set initial visibility
    document.body.style.cursor = 'none'
    setIsVisible(true)

    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mouseenter', handleMouseEnter)
    document.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      document.body.style.cursor = 'auto'
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mouseenter', handleMouseEnter)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [cursorX, cursorY])

  // Don't render on touch devices
  if (typeof window !== 'undefined' && !window.matchMedia('(pointer: fine)').matches) {
    return null
  }

  const currentState = isDown ? 'down' : isText ? 'text' : isPointer ? 'pointer' : cursorVariant

  // Sizes for different states
  const sizes = {
    default: { outer: 40, inner: 40, dot: 4 },
    pointer: { outer: 56, inner: 56, dot: 8 },
    text: { outer: 2, inner: 2, dot: 2 },
    down: { outer: 30, inner: 30, dot: 12 },
    magnetic: { outer: 80, inner: 80, dot: 6 },
  }

  const currentSize = sizes[currentState as keyof typeof sizes] || sizes.default

  return (
    <>
      {/* Ripple effects */}
      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.div
            key={ripple.id}
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: 4, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: '2px solid rgb(147, 51, 234)',
              pointerEvents: 'none',
              zIndex: 9997,
              x: ripple.x - 20,
              y: ripple.y - 20,
            }}
          />
        ))}
      </AnimatePresence>

      {/* Cursor Container - Single element containing all parts */}
      <motion.div
        style={{
          position: 'fixed',
          x: cursorXSpring,
          y: cursorYSpring,
          width: 0,
          height: 0,
          pointerEvents: 'none',
          zIndex: 9999,
        }}
      >
        {/* Outer ring */}
        <motion.div
          className="cursor-ring"
          animate={{
            width: currentSize.outer,
            height: currentSize.outer,
            opacity: isVisible ? (isText ? 0 : 0.5) : 0,
          }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            borderRadius: isText ? '1px' : '50%',
            border: '2px solid rgb(147, 51, 234)',
            backgroundColor: 'transparent',
            boxShadow: '0 0 20px rgba(147, 51, 234, 0.3)',
          }}
        />

        {/* Main cursor circle */}
        <motion.div
          className="custom-cursor"
          animate={{
            width: currentSize.inner,
            height: currentSize.inner,
            opacity: isVisible ? 0.15 : 0,
          }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            borderRadius: isText ? '1px' : '50%',
            backgroundColor: 'rgba(147, 51, 234, 0.15)',
          }}
        />

        {/* Center dot - ALWAYS perfectly centered */}
        <motion.div
          className="cursor-dot"
          animate={{
            width: currentSize.dot,
            height: isText ? 16 : currentSize.dot,
            opacity: isVisible ? 1 : 0,
          }}
          transition={{ type: 'spring', damping: 30, stiffness: 500 }}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            borderRadius: isText ? '1px' : '50%',
            backgroundColor: 'rgb(147, 51, 234)',
          }}
        />

        {/* Trailing glow effect */}
        <motion.div
          className="cursor-trail"
          animate={{
            scale: isPointer ? 1.5 : 1,
            opacity: isVisible && isPointer ? 0.3 : 0,
          }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(147, 51, 234, 0.2) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
      </motion.div>
    </>
  )
}