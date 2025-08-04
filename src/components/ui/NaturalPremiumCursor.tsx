'use client'

import { useEffect, useRef, useState } from 'react'

export function NaturalPremiumCursor() {
  const cursorDotRef = useRef<HTMLDivElement>(null)
  const cursorRingRef = useRef<HTMLDivElement>(null)
  const requestRef = useRef<number>()
  const [isPointer, setIsPointer] = useState(false)
  
  // Mouse position
  const mouse = useRef({ x: -100, y: -100 })
  const delayedMouse = useRef({ x: -100, y: -100 })
  
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return

    let clientX = -100
    let clientY = -100
    
    const handleMouseMove = (e: MouseEvent) => {
      clientX = e.clientX
      clientY = e.clientY
      mouse.current = { x: clientX, y: clientY }
      
      // Check hover state
      const target = e.target as HTMLElement
      const isClickable = 
        window.getComputedStyle(target).cursor === 'pointer' ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.closest('button') !== null ||
        target.closest('a') !== null
        
      setIsPointer(isClickable)
    }

    const animate = () => {
      // Instant dot movement
      if (cursorDotRef.current) {
        cursorDotRef.current.style.transform = `translate(${mouse.current.x}px, ${mouse.current.y}px) translate(-50%, -50%)`
      }
      
      // Smooth ring follow with easing
      delayedMouse.current.x += (mouse.current.x - delayedMouse.current.x) * 0.12
      delayedMouse.current.y += (mouse.current.y - delayedMouse.current.y) * 0.12
      
      if (cursorRingRef.current) {
        cursorRingRef.current.style.transform = `translate(${delayedMouse.current.x}px, ${delayedMouse.current.y}px) translate(-50%, -50%)`
      }
      
      requestRef.current = requestAnimationFrame(animate)
    }
    
    // Hide default cursor
    document.body.style.cursor = 'none'
    
    // Start animation
    requestRef.current = requestAnimationFrame(animate)
    
    // Add listener
    window.addEventListener('mousemove', handleMouseMove)
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
      }
      window.removeEventListener('mousemove', handleMouseMove)
      document.body.style.cursor = 'auto'
    }
  }, [])

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
      
      {/* Ring - smooth follow */}
      <div
        ref={cursorRingRef}
        className="pointer-events-none fixed left-0 top-0"
        style={{
          zIndex: 2147483646,
          width: isPointer ? '48px' : '40px',
          height: isPointer ? '48px' : '40px',
          marginLeft: isPointer ? '-24px' : '-20px',
          marginTop: isPointer ? '-24px' : '-20px',
          border: '2px solid',
          borderColor: isPointer ? 'rgb(168, 85, 247)' : 'rgb(147, 51, 234)',
          borderRadius: '50%',
          opacity: 0.8,
          transition: 'width 0.15s ease-out, height 0.15s ease-out, margin 0.15s ease-out, border-color 0.15s ease-out',
          willChange: 'transform',
        }}
      />
      
      {/* Dot - instant movement */}
      <div
        ref={cursorDotRef}
        className="pointer-events-none fixed left-0 top-0 z-[9999999]"
        style={{
          width: '6px',
          height: '6px',
          marginLeft: '-3px',
          marginTop: '-3px',
          backgroundColor: isPointer ? 'rgb(168, 85, 247)' : 'rgb(147, 51, 234)',
          borderRadius: '50%',
          transition: 'background-color 0.15s ease-out',
          willChange: 'transform',
          boxShadow: '0 0 8px rgba(147, 51, 234, 0.5)',
        }}
      />
    </>
  )
}