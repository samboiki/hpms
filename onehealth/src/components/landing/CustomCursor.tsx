'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useSpring, useMotionValue } from 'framer-motion'

export function CustomCursor() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [cursorVariant, setCursorVariant] = useState('default')
  const [isPointer, setIsPointer] = useState(false)
  const cursorRef = useRef<HTMLDivElement>(null)

  // Spring physics for smooth movement
  const springConfig = { damping: 25, stiffness: 400 }
  const cursorX = useMotionValue(0)
  const cursorY = useMotionValue(0)
  const cursorXSpring = useSpring(cursorX, springConfig)
  const cursorYSpring = useSpring(cursorY, springConfig)

  useEffect(() => {
    // Only show custom cursor on non-touch devices
    if (!window.matchMedia('(pointer: fine)').matches) {
      return
    }

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
      cursorX.set(e.clientX - 16)
      cursorY.set(e.clientY - 16)

      // Check if hovering over clickable element
      const target = e.target as HTMLElement
      const isClickable = 
        target.tagName === 'A' ||
        target.tagName === 'BUTTON' ||
        target.onclick !== null ||
        target.closest('a') !== null ||
        target.closest('button') !== null ||
        target.getAttribute('data-cursor') === 'pointer'

      setIsPointer(isClickable)
    }

    const handleMouseEnter = () => {
      if (cursorRef.current) {
        cursorRef.current.style.opacity = '1'
      }
    }

    const handleMouseLeave = () => {
      if (cursorRef.current) {
        cursorRef.current.style.opacity = '0'
      }
    }

    // Hide default cursor
    document.body.style.cursor = 'none'

    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseenter', handleMouseEnter)
    document.addEventListener('mouseleave', handleMouseLeave)

    // Add global hover listeners for cursor variants
    const addHoverListeners = () => {
      const hoverElements = document.querySelectorAll('[data-cursor]')
      hoverElements.forEach((el) => {
        el.addEventListener('mouseenter', (e) => {
          const target = e.target as HTMLElement
          const variant = target.getAttribute('data-cursor') || 'default'
          setCursorVariant(variant)
        })
        el.addEventListener('mouseleave', () => {
          setCursorVariant('default')
        })
      })
    }

    addHoverListeners()

    return () => {
      document.body.style.cursor = 'auto'
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseenter', handleMouseEnter)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [cursorX, cursorY])

  const variants = {
    default: {
      width: 32,
      height: 32,
      backgroundColor: 'rgba(147, 51, 234, 0.1)',
      border: '2px solid rgba(147, 51, 234, 0.5)',
      scale: 1,
    },
    hover: {
      width: 48,
      height: 48,
      backgroundColor: 'rgba(147, 51, 234, 0.05)',
      border: '2px solid rgba(147, 51, 234, 0.8)',
      scale: 1.5,
    },
    click: {
      width: 24,
      height: 24,
      backgroundColor: 'rgba(147, 51, 234, 0.3)',
      border: '2px solid rgba(147, 51, 234, 1)',
      scale: 0.8,
    },
  }

  // Don't render on touch devices
  if (typeof window !== 'undefined' && !window.matchMedia('(pointer: fine)').matches) {
    return null
  }

  return (
    <>
      {/* Main cursor */}
      <motion.div
        ref={cursorRef}
        className="custom-cursor"
        variants={variants}
        animate={isPointer ? 'hover' : cursorVariant}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        style={{
          x: cursorXSpring,
          y: cursorYSpring,
          position: 'fixed',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 9999,
          mixBlendMode: 'difference',
          opacity: 0,
        }}
      />

      {/* Cursor dot */}
      <motion.div
        className="cursor-dot"
        style={{
          x: cursorX,
          y: cursorY,
          position: 'fixed',
          width: 4,
          height: 4,
          backgroundColor: 'rgba(147, 51, 234, 1)',
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 10000,
          transform: 'translate(14px, 14px)',
          opacity: 0,
        }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      />

      <style jsx global>{`
        /* Hide cursor on all elements when custom cursor is active */
        @media (pointer: fine) {
          * {
            cursor: none !important;
          }
        }

        /* Magnetic effect for buttons */
        [data-cursor="magnetic"] {
          transition: transform 0.2s ease-out;
        }

        [data-cursor="magnetic"]:hover {
          transform: scale(1.05);
        }

        /* Custom cursor styles for different states */
        .custom-cursor {
          transition: opacity 0.3s ease-in-out;
        }

        /* Ensure cursor is visible on light and dark backgrounds */
        @supports (mix-blend-mode: difference) {
          .custom-cursor {
            mix-blend-mode: difference;
          }
        }

        /* Disable on mobile */
        @media (hover: none) and (pointer: coarse) {
          .custom-cursor,
          .cursor-dot {
            display: none !important;
          }

          * {
            cursor: auto !important;
          }
        }
      `}</style>
    </>
  )
}