'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion'
import './UltraPremiumCursor.css'

interface Particle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

export function UltraPremiumCursor() {
  const [isVisible, setIsVisible] = useState(false)
  const [cursorVariant, setCursorVariant] = useState('default')
  const [isClicking, setIsClicking] = useState(false)
  const [particles, setParticles] = useState<Particle[]>([])
  const [magneticTarget, setMagneticTarget] = useState<{ x: number; y: number } | null>(null)
  
  // Mouse position with ultra-smooth tracking
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  
  // Premium spring configurations
  const ultraSmoothSpring = {
    damping: 30,
    stiffness: 400,
    mass: 0.3,
    restDelta: 0.001
  }
  
  const magneticSpring = {
    damping: 35,
    stiffness: 150,
    mass: 0.8
  }
  
  // Smooth cursor position
  const cursorX = useSpring(mouseX, ultraSmoothSpring)
  const cursorY = useSpring(mouseY, ultraSmoothSpring)
  
  // Magnetic effect position
  const magnetX = useSpring(mouseX, magneticSpring)
  const magnetY = useSpring(mouseY, magneticSpring)
  
  // Performance refs
  const rafId = useRef<number>()
  const targetX = useRef(0)
  const targetY = useRef(0)
  const lastTime = useRef(0)
  const particleId = useRef(0)
  
  // Particle system update
  useEffect(() => {
    if (particles.length === 0) return
    
    const updateParticles = () => {
      setParticles(prev => 
        prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.3, // gravity
            life: p.life - 0.02
          }))
          .filter(p => p.life > 0)
      )
    }
    
    const interval = setInterval(updateParticles, 16)
    return () => clearInterval(interval)
  }, [particles.length])
  
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return

    // Ultra-smooth position tracking
    const updatePosition = (time: number) => {
      const deltaTime = time - lastTime.current
      
      if (deltaTime > 16) { // Cap at ~60fps
        const dx = targetX.current - mouseX.get()
        const dy = targetY.current - mouseY.get()
        
        if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
          mouseX.set(targetX.current)
          mouseY.set(targetY.current)
        }
        
        lastTime.current = time
      }
      
      rafId.current = requestAnimationFrame(updatePosition)
    }
    
    const handleMouseMove = (e: MouseEvent) => {
      targetX.current = e.clientX
      targetY.current = e.clientY
      
      const target = e.target as HTMLElement
      const style = window.getComputedStyle(target)
      
      // Detect interactive elements
      const isButton = 
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.closest('button') !== null ||
        target.closest('a') !== null ||
        target.closest('[role="button"]') !== null ||
        style.cursor === 'pointer'
        
      const isText = 
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        style.cursor === 'text'
        
      const isDisabled = 
        target.getAttribute('disabled') !== null ||
        style.cursor === 'not-allowed'
        
      // Check for magnetic elements
      if (target.hasAttribute('data-magnetic')) {
        const rect = target.getBoundingClientRect()
        setMagneticTarget({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        })
      } else {
        setMagneticTarget(null)
      }
      
      // Set cursor variant
      if (isDisabled) {
        setCursorVariant('disabled')
      } else if (isText) {
        setCursorVariant('text')
      } else if (isButton) {
        setCursorVariant('pointer')
      } else {
        setCursorVariant('default')
      }
    }

    const handleMouseDown = (e: MouseEvent) => {
      setIsClicking(true)
      
      // Create explosion particles
      const newParticles: Particle[] = []
      for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 * i) / 12
        const velocity = 3 + Math.random() * 2
        newParticles.push({
          id: particleId.current++,
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity - 2,
          life: 1
        })
      }
      setParticles(prev => [...prev, ...newParticles])
    }

    const handleMouseUp = () => {
      setIsClicking(false)
    }

    const handleMouseEnter = () => {
      setIsVisible(true)
      document.body.style.cursor = 'none'
    }

    const handleMouseLeave = () => {
      setIsVisible(false)
    }

    // Initialize
    rafId.current = requestAnimationFrame(updatePosition)
    document.body.style.cursor = 'none'
    setIsVisible(true)

    // Event listeners
    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mouseenter', handleMouseEnter)
    document.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current)
      document.body.style.cursor = 'auto'
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mouseenter', handleMouseEnter)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [mouseX, mouseY])

  if (typeof window !== 'undefined' && !window.matchMedia('(pointer: fine)').matches) {
    return null
  }

  return (
    <div className="ultra-premium-cursor-container">
      {/* Particle effects */}
      <AnimatePresence>
        {particles.map(particle => (
          <motion.div
            key={particle.id}
            className="cursor-particle"
            initial={{ scale: 1, opacity: 1 }}
            animate={{ 
              scale: 0,
              opacity: 0,
              x: particle.x,
              y: particle.y
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              width: 4,
              height: 4,
              borderRadius: '50%',
              backgroundColor: 'rgb(147, 51, 234)',
              pointerEvents: 'none',
              left: -2,
              top: -2,
            }}
          />
        ))}
      </AnimatePresence>

      {/* Magnetic field effect */}
      {magneticTarget && (
        <motion.div
          className="magnetic-field"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.15 }}
          exit={{ scale: 0, opacity: 0 }}
          style={{
            position: 'fixed',
            x: magnetX,
            y: magnetY,
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(147, 51, 234, 0.3) 0%, transparent 70%)',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Main cursor with morphing shapes */}
      <motion.div
        className="ultra-cursor-main"
        style={{
          position: 'fixed',
          x: cursorX,
          y: cursorY,
          width: 0,
          height: 0,
          pointerEvents: 'none',
        }}
      >
        {/* Outer ring with gradient */}
        <motion.div
          className="cursor-ring-outer"
          animate={{
            scale: isClicking ? 0.8 : cursorVariant === 'pointer' ? 1.3 : 1,
            opacity: isVisible ? 0.4 : 0,
            rotateZ: cursorVariant === 'pointer' ? 180 : 0,
          }}
          transition={{
            scale: { type: 'spring', damping: 25, stiffness: 300 },
            rotateZ: { duration: 0.4, ease: 'easeInOut' }
          }}
          style={{
            position: 'absolute',
            width: 40,
            height: 40,
            borderRadius: cursorVariant === 'text' ? '2px' : '50%',
            border: '2px solid transparent',
            backgroundImage: 'linear-gradient(45deg, rgb(147, 51, 234), rgb(236, 72, 153))',
            backgroundClip: 'padding-box',
            transform: 'translate(-50%, -50%)',
          }}
        />

        {/* Inner circle with glow */}
        <motion.div
          className="cursor-inner"
          animate={{
            scale: isClicking ? 1.5 : 1,
            opacity: isVisible ? 1 : 0,
            width: cursorVariant === 'text' ? 2 : cursorVariant === 'pointer' ? 12 : 8,
            height: cursorVariant === 'text' ? 20 : cursorVariant === 'pointer' ? 12 : 8,
            borderRadius: cursorVariant === 'text' ? '1px' : '50%',
          }}
          transition={{
            type: 'spring',
            damping: 30,
            stiffness: 400,
          }}
          style={{
            position: 'absolute',
            backgroundColor: 'rgb(147, 51, 234)',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 20px rgba(147, 51, 234, 0.5)',
          }}
        />

        {/* Trailing aura */}
        <motion.div
          className="cursor-aura"
          animate={{
            scale: cursorVariant === 'pointer' ? 2 : 1.5,
            opacity: isVisible && cursorVariant === 'pointer' ? 0.2 : 0,
          }}
          transition={{
            type: 'spring',
            damping: 20,
            stiffness: 150,
          }}
          style={{
            position: 'absolute',
            width: 60,
            height: 60,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(147, 51, 234, 0.3) 0%, rgba(236, 72, 153, 0.1) 50%, transparent 70%)',
            transform: 'translate(-50%, -50%)',
            filter: 'blur(10px)',
          }}
        />

        {/* Ripple effect on click */}
        <AnimatePresence>
          {isClicking && (
            <motion.div
              className="click-ripple"
              initial={{ scale: 0, opacity: 0.6 }}
              animate={{ scale: 4, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                width: 20,
                height: 20,
                borderRadius: '50%',
                border: '2px solid rgb(147, 51, 234)',
                transform: 'translate(-50%, -50%)',
              }}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}