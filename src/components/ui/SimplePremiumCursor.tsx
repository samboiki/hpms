'use client'

import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

export function SimplePremiumCursor() {
  const [isPointer, setIsPointer] = useState(false)
  
  const cursorX = useMotionValue(-100)
  const cursorY = useMotionValue(-100)
  
  const springConfig = { damping: 25, stiffness: 700 }
  const cursorXSpring = useSpring(cursorX, springConfig)
  const cursorYSpring = useSpring(cursorY, springConfig)

  useEffect(() => {
    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX - 16)
      cursorY.set(e.clientY - 16)
      
      // Check if hovering over clickable element
      const target = e.target as HTMLElement
      setIsPointer(
        window.getComputedStyle(target).cursor === 'pointer' ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.closest('button') !== null ||
        target.closest('a') !== null
      )
    }

    window.addEventListener('mousemove', moveCursor)
    
    // Hide default cursor
    document.body.style.cursor = 'none'
    
    return () => {
      window.removeEventListener('mousemove', moveCursor)
      document.body.style.cursor = 'auto'
    }
  }, [cursorX, cursorY])

  return (
    <>
      <style jsx global>{`
        * {
          cursor: none !important;
        }
      `}</style>
      
      <motion.div
        className="pointer-events-none fixed z-[9999999]"
        style={{
          left: cursorXSpring,
          top: cursorYSpring,
        }}
      >
        <motion.div
          animate={{
            scale: isPointer ? 1.5 : 1,
          }}
          transition={{ type: "spring", stiffness: 300, damping: 10 }}
        >
          {/* Outer ring */}
          <div className="absolute w-8 h-8 border-2 border-purple-500 rounded-full opacity-80" />
          
          {/* Inner dot */}
          <div className="absolute w-8 h-8 flex items-center justify-center">
            <div className="w-1 h-1 bg-purple-500 rounded-full" />
          </div>
        </motion.div>
      </motion.div>
    </>
  )
}