'use client'

import { motion, useScroll, useSpring } from 'framer-motion'

export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  })

  return (
    <>
      <motion.div
        className="scroll-progress-bar"
        style={{ scaleX }}
      />
      <style jsx global>{`
        .scroll-progress-bar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(
            90deg,
            #9333ea 0%,
            #ec4899 50%,
            #3b82f6 100%
          );
          transform-origin: 0%;
          z-index: 100;
          box-shadow: 0 0 10px rgba(147, 51, 234, 0.5);
        }

        /* Add glow effect on scroll */
        .scroll-progress-bar::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: inherit;
          filter: blur(5px);
          opacity: 0.5;
        }

        /* Hide on mobile for better performance */
        @media (max-width: 768px) {
          .scroll-progress-bar {
            display: none;
          }
        }

        /* Respect reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .scroll-progress-bar {
            display: none;
          }
        }
      `}</style>
    </>
  )
}