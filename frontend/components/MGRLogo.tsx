'use client'

import { useTheme } from 'next-themes'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

export default function MGRLogo({ size = 'normal' }: { size?: 'small' | 'normal' | 'large' }) {
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const currentTheme = mounted ? (resolvedTheme || theme) : 'light'

  const variants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
    hover: { scale: 1.05, rotate: 2, transition: { duration: 0.3 } },
  }

  const sizes = {
    small: { width: 120, height: 40 },
    normal: { width: 240, height: 80 },
    large: { width: 360, height: 120 },
  }

  const { width, height } = sizes[size]

  // Dynamic favicon generation (runs once per theme change)
  useEffect(() => {
    if (!mounted) return

    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')
    if (ctx) {
      // Background
      const gradient = ctx.createLinearGradient(0, 0, 32, 32)
      gradient.addColorStop(0, '#3b82f6')
      gradient.addColorStop(1, '#8b5cf6')

      // Rounded rectangle
      ctx.beginPath()
      ctx.roundRect(0, 0, 32, 32, 8)
      ctx.fillStyle = gradient
      ctx.fill()

      // Letter M
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 20px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('M', 16, 17)

      // Update favicon
      const favicon = document.getElementById('dynamic-favicon') as HTMLLinkElement
      if (favicon) {
        favicon.href = canvas.toDataURL('image/png')
      } else {
        const link = document.createElement('link')
        link.id = 'dynamic-favicon'
        link.rel = 'icon'
        link.type = 'image/png'
        link.href = canvas.toDataURL('image/png')
        document.head.appendChild(link)
      }
    }
  }, [currentTheme, mounted])

  const isDark = currentTheme === 'dark'
  const primaryColor = isDark ? '#3b82f6' : '#1e40af'
  const secondaryColor = isDark ? '#8b5cf6' : '#6d28d9'
  const textColor = isDark ? '#cbd5e1' : '#64748b'

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      whileHover="hover"
      variants={variants}
      className="select-none cursor-pointer"
      role="img"
      aria-label="MGR Capital Assistance Logo"
    >
      <svg
        width={width}
        height={height}
        viewBox="0 0 240 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-lg"
      >
        <defs>
          <linearGradient id="mgrGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={primaryColor}>
              <animate
                attributeName="stop-color"
                values={`${primaryColor};${secondaryColor};${primaryColor}`}
                dur="4s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor={secondaryColor}>
              <animate
                attributeName="stop-color"
                values={`${secondaryColor};${primaryColor};${secondaryColor}`}
                dur="4s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.2"/>
          </filter>
        </defs>

        <g filter="url(#glow)">
          {/* MGR Text */}
          <text
            x="10"
            y="55"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize="52"
            fontWeight="900"
            fill="url(#mgrGrad1)"
            letterSpacing="-2"
            filter="url(#shadow)"
          >
            MGR
          </text>

          {/* CAPITAL Text */}
          <text
            x="125"
            y="55"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontSize="28"
            fontWeight="500"
            fill={textColor}
            letterSpacing="1"
          >
            CAPITAL
          </text>

          {/* Animated underline */}
          <rect x="0" y="70" width="240" height="4" rx="2" fill="url(#mgrGrad1)" opacity="0.6">
            <animate
              attributeName="width"
              from="0"
              to="240"
              dur="1s"
              fill="freeze"
              begin="0.3s"
            />
          </rect>

          {/* Pulse dot */}
          <circle cx="235" cy="72" r="3" fill="url(#mgrGrad1)">
            <animate
              attributeName="opacity"
              values="1;0.4;1"
              dur="2s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="r"
              values="3;4;3"
              dur="2s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      </svg>
    </motion.div>
  )
}
