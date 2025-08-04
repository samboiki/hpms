'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)
  const [ripples, setRipples] = useState<Array<{id: number, x: number, y: number}>>([])
  
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  
  const springConfig = { damping: 20, stiffness: 300 }
  const cursorX = useSpring(mouseX, springConfig)
  const cursorY = useSpring(mouseY, springConfig)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX)
      mouseY.set(e.clientY)
    }

    const handleMouseClick = (e: MouseEvent) => {
      const newRipple = {
        id: Date.now(),
        x: e.clientX,
        y: e.clientY
      }
      setRipples(prev => [...prev, newRipple])
      
      // Remove ripple after animation
      setTimeout(() => {
        setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id))
      }, 1000)
    }

    const handleMouseEnter = () => {
      if (cursorRef.current) cursorRef.current.style.opacity = '1'
      if (dotRef.current) dotRef.current.style.opacity = '1'
    }

    const handleMouseLeave = () => {
      if (cursorRef.current) cursorRef.current.style.opacity = '0'
      if (dotRef.current) dotRef.current.style.opacity = '0'
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('click', handleMouseClick)
    document.addEventListener('mouseenter', handleMouseEnter)
    document.addEventListener('mouseleave', handleMouseLeave)

    // Handle hover states
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.getAttribute('data-cursor') === 'pointer' ||
        target.closest('button') ||
        target.closest('a')
      ) {
        if (cursorRef.current) {
          cursorRef.current.style.width = '40px'
          cursorRef.current.style.height = '40px'
          cursorRef.current.style.backgroundColor = 'rgba(147, 51, 234, 0.2)'
          cursorRef.current.style.border = '2px solid rgba(147, 51, 234, 0.8)'
        }
        if (dotRef.current) {
          dotRef.current.style.transform = 'scale(2)'
        }
      }
    }

    const handleMouseOut = () => {
      if (cursorRef.current) {
        cursorRef.current.style.width = '32px'
        cursorRef.current.style.height = '32px'
        cursorRef.current.style.backgroundColor = 'transparent'
        cursorRef.current.style.border = '2px solid rgba(147, 51, 234, 0.5)'
      }
      if (dotRef.current) {
        dotRef.current.style.transform = 'scale(1)'
      }
    }

    document.addEventListener('mouseover', handleMouseOver)
    document.addEventListener('mouseout', handleMouseOut)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('click', handleMouseClick)
      document.removeEventListener('mouseenter', handleMouseEnter)
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('mouseover', handleMouseOver)
      document.removeEventListener('mouseout', handleMouseOut)
    }
  }, [mouseX, mouseY])

  return (
    <>
      <motion.div
        ref={cursorRef}
        className="custom-cursor"
        style={{
          position: 'fixed',
          width: '32px',
          height: '32px',
          border: '2px solid rgba(147, 51, 234, 0.5)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 9999,
          x: cursorX,
          y: cursorY,
          translateX: '-50%',
          translateY: '-50%',
          transition: 'width 0.3s, height 0.3s, background-color 0.3s, border 0.3s',
          opacity: 0,
        }}
      />
      <motion.div
        ref={dotRef}
        className="cursor-dot"
        style={{
          position: 'fixed',
          width: '4px',
          height: '4px',
          backgroundColor: 'rgba(147, 51, 234, 1)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 10000,
          x: mouseX,
          y: mouseY,
          translateX: '-50%',
          translateY: '-50%',
          opacity: 0,
          transition: 'transform 0.3s',
        }}
      />
      {/* Ripple effects */}
      {ripples.map(ripple => (
        <motion.div
          key={ripple.id}
          className="cursor-ripple"
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            left: ripple.x,
            top: ripple.y,
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '2px solid rgba(147, 51, 234, 0.5)',
            backgroundColor: 'rgba(147, 51, 234, 0.1)',
            pointerEvents: 'none',
            zIndex: 9998,
            translateX: '-50%',
            translateY: '-50%',
          }}
        />
      ))}
    </>
  )
}