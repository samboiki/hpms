import { motion, useAnimation, useInView } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar'

// Ultra-Premium Metric Widget with Holographic Effects
interface UltraMetricWidgetProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: {
    value: number
    direction: 'up' | 'down'
    label: string
  }
  icon: string
  gradient: string
  loading?: boolean
  animation?: 'float' | 'pulse' | 'glow' | 'none'
}

export function UltraMetricWidget({
  title,
  value,
  subtitle,
  trend,
  icon,
  gradient,
  loading = false,
  animation = 'float'
}: UltraMetricWidgetProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })
  const controls = useAnimation()
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    if (isInView) {
      controls.start({
        opacity: 1,
        y: 0,
        rotateX: 0,
        transition: { duration: 0.8, ease: 'easeOut' }
      })
    }
  }, [isInView, controls])

  const animationVariants = {
    float: {
      y: [-5, 5, -5],
      transition: { repeat: Infinity, duration: 4, ease: 'easeInOut' }
    },
    pulse: {
      scale: [1, 1.02, 1],
      transition: { repeat: Infinity, duration: 2, ease: 'easeInOut' }
    },
    glow: {
      boxShadow: [
        '0 0 20px rgba(79, 172, 254, 0.3)',
        '0 0 40px rgba(79, 172, 254, 0.6)',
        '0 0 20px rgba(79, 172, 254, 0.3)'
      ],
      transition: { repeat: Infinity, duration: 3, ease: 'easeInOut' }
    },
    none: {}
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50, rotateX: -15 }}
      animate={controls}
      whileHover={{
        y: -8,
        rotateX: 5,
        rotateY: 2,
        scale: 1.02,
        transition: { duration: 0.3 }
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="premium-card rounded-3xl p-8 relative overflow-hidden group cursor-pointer transform-gpu"
      style={{
        background: `linear-gradient(145deg, rgba(255,255,255,0.95), rgba(255,255,255,0.85))`,
        backdropFilter: 'blur(30px)',
        perspective: '1000px',
        transformStyle: 'preserve-3d'
      }}
    >
      {/* Holographic Background Effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 via-purple-400/10 to-pink-400/10 rounded-3xl" />
        <div className="absolute inset-0 animate-pulse opacity-20 bg-white/5" />
      </div>

      {/* Animated Border */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent rounded-t-3xl" />

      {/* Content */}
      <div className="relative z-10">
        {loading ? (
          <div className="animate-pulse">
            <div className="flex items-center justify-between mb-6">
              <div className="w-16 h-16 bg-gray-200 rounded-2xl" />
              <div className="text-right">
                <div className="h-8 bg-gray-200 rounded w-20 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-16" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <motion.div
                animate={isHovered ? { rotateY: 180 } : { rotateY: 0 }}
                transition={{ duration: 0.6 }}
                className={`p-4 rounded-2xl bg-gradient-to-br ${gradient} shadow-xl relative overflow-hidden`}
                style={{ transformStyle: 'preserve-3d' }}
              >
                <motion.div
                  className="absolute inset-0 bg-white/20 rounded-2xl"
                  animate={{ rotate: isHovered ? 360 : 0 }}
                  transition={{ duration: 2 }}
                />
                <Icon icon={icon} className="w-8 h-8 text-white relative z-10" />
              </motion.div>

              <div className="text-right">
                <motion.h3
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', bounce: 0.5 }}
                  className="font-heading text-4xl font-bold text-gradient mb-1"
                >
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </motion.h3>
                <p className="text-sm text-gray-600 font-body font-medium">{title}</p>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3">
              {subtitle && (
                <p className="text-gray-600 font-body text-sm leading-relaxed">{subtitle}</p>
              )}

              {trend && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex items-center justify-between"
                >
                  <div className={`inline-flex items-center px-3 py-2 rounded-xl ${
                    trend.direction === 'up'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    <Icon
                      icon={trend.direction === 'up' ? 'solar:arrow-up-bold' : 'solar:arrow-down-bold'}
                      className="w-4 h-4 mr-2"
                    />
                    <span className="font-heading font-bold">{Math.abs(trend.value)}%</span>
                  </div>
                  <span className="text-xs text-gray-500 font-body">{trend.label}</span>
                </motion.div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Floating Elements */}
      <motion.div
        animate={{
          y: isHovered ? [-10, -15, -10] : [0, 5, 0],
          x: isHovered ? [0, 5, 0] : [0, 0, 0],
          opacity: isHovered ? 0.8 : 0.3
        }}
        transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
        className="absolute top-8 right-8 w-4 h-4 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full shadow-lg"
      />
      <motion.div
        animate={{
          y: isHovered ? [5, 0, 5] : [0, -3, 0],
          x: isHovered ? [0, -3, 0] : [0, 0, 0],
          opacity: isHovered ? 0.6 : 0.2
        }}
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut', delay: 1 }}
        className="absolute bottom-8 left-8 w-3 h-3 bg-gradient-to-br from-pink-400 to-red-500 rounded-full shadow-md"
      />

      {/* Animation Effects */}
      {animation !== 'none' && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
        />
      )}
    </motion.div>
  )
}

// Premium Progress Ring Widget
interface ProgressRingProps {
  title: string
  percentage: number
  value: string
  color: string
  strokeWidth?: number
  size?: number
}

export function UltraProgressRing({
  title,
  percentage,
  value,
  color,
  strokeWidth = 8,
  size = 120
}: ProgressRingProps) {
  const [animatedPercentage, setAnimatedPercentage] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage)
    }, 300)
    return () => clearTimeout(timer)
  }, [percentage])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, type: 'spring' }}
      whileHover={{ scale: 1.05 }}
      className="premium-card rounded-3xl p-6 text-center group"
    >
      <div className="mb-4">
        <h4 className="font-heading text-lg font-bold text-gray-800 mb-1">{title}</h4>
      </div>

      <div className="relative inline-block mb-4">
        <div style={{ width: size, height: size }}>
          <CircularProgressbar
            value={animatedPercentage}
            text={`${Math.round(percentage)}%`}
            styles={buildStyles({
              pathColor: color,
              textColor: '#374151',
              trailColor: 'rgba(255,255,255,0.3)',
              backgroundColor: 'transparent',
              pathTransitionDuration: 2,
              strokeLinecap: 'round',
              textSize: '14px'
            })}
            strokeWidth={strokeWidth}
          />
        </div>

        {/* Glow Effect */}
        <div
          className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
            filter: 'blur(10px)'
          }}
        />
      </div>

      <div className="text-center">
        <p className="font-heading text-2xl font-bold text-gray-800 mb-1">{value}</p>
        <p className="text-sm text-gray-600 font-body">Current Value</p>
      </div>
    </motion.div>
  )
}

// Advanced Stats Grid Widget
interface StatsGridProps {
  stats: Array<{
    label: string
    value: string | number
    icon: string
    color: string
    change?: number
  }>
  title: string
}

export function UltraStatsGrid({ stats, title }: StatsGridProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="premium-card rounded-3xl p-8"
    >
      <div className="mb-8">
        <h3 className="font-heading text-2xl font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-600 font-body">Key performance indicators</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -5, scale: 1.02 }}
            className="text-center group"
          >
            <motion.div
              whileHover={{ rotateY: 180 }}
              transition={{ duration: 0.6 }}
              className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${stat.color} shadow-lg mb-4 group-hover:shadow-xl transition-shadow`}
            >
              <Icon icon={stat.icon} className="w-8 h-8 text-white" />
            </motion.div>

            <div>
              <h4 className="font-heading text-2xl font-bold text-gray-800 mb-1">
                {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
              </h4>
              <p className="text-sm text-gray-600 font-body mb-2">{stat.label}</p>

              {stat.change !== undefined && (
                <div className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold ${
                  stat.change >= 0
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  <Icon
                    icon={stat.change >= 0 ? 'solar:arrow-up-bold' : 'solar:arrow-down-bold'}
                    className="w-3 h-3 mr-1"
                  />
                  {Math.abs(stat.change)}%
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

// Premium Activity Timeline Widget
interface ActivityTimelineProps {
  activities: Array<{
    id: string
    title: string
    description: string
    timestamp: string
    type: 'success' | 'warning' | 'info' | 'error'
    icon: string
  }>
  title: string
}

export function UltraActivityTimeline({ activities, title }: ActivityTimelineProps) {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success': return 'from-green-500 to-emerald-500'
      case 'warning': return 'from-yellow-500 to-orange-500'
      case 'info': return 'from-blue-500 to-cyan-500'
      case 'error': return 'from-red-500 to-pink-500'
      default: return 'from-gray-500 to-slate-500'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8 }}
      className="premium-card rounded-3xl p-8 premium-scrollbar max-h-96 overflow-y-auto"
    >
      <div className="mb-8">
        <h3 className="font-heading text-2xl font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-600 font-body">Recent system activities</p>
      </div>

      <div className="relative">
        {/* Timeline Line */}
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 to-purple-500 opacity-30" />

        <div className="space-y-6">
          {activities.map((activity, index) => (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ x: 5 }}
              className="relative flex items-start space-x-4 group"
            >
              {/* Timeline Node */}
              <motion.div
                whileHover={{ scale: 1.2 }}
                className={`relative z-10 flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${getTypeColor(activity.type)} shadow-lg`}
              >
                <Icon icon={activity.icon} className="w-8 h-8 text-white" />

                {/* Pulse Effect */}
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${getTypeColor(activity.type)} opacity-75 animate-ping`} />
              </motion.div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="bg-white/50 backdrop-blur-sm rounded-xl p-4 border border-white/30 group-hover:bg-white/70 transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-heading font-bold text-gray-800 truncate">{activity.title}</h4>
                    <span className="text-xs text-gray-500 font-body whitespace-nowrap ml-2">
                      {activity.timestamp}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 font-body leading-relaxed">{activity.description}</p>
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// Ultra-Premium System Health Widget
interface SystemHealthProps {
  metrics: {
    uptime: number
    cpu: number
    memory: number
    disk: number
    network: number
  }
}

export function UltraSystemHealth({ metrics }: SystemHealthProps) {
  const getHealthColor = (value: number, type: 'uptime' | 'usage') => {
    if (type === 'uptime') {
      if (value >= 99) return 'from-green-500 to-emerald-500'
      if (value >= 95) return 'from-yellow-500 to-orange-500'
      return 'from-red-500 to-pink-500'
    } else {
      if (value <= 60) return 'from-green-500 to-emerald-500'
      if (value <= 80) return 'from-yellow-500 to-orange-500'
      return 'from-red-500 to-pink-500'
    }
  }

  const healthMetrics = [
    { label: 'Uptime', value: metrics.uptime, suffix: '%', icon: 'solar:pulse-bold-duotone', type: 'uptime' as const },
    { label: 'CPU', value: metrics.cpu, suffix: '%', icon: 'solar:cpu-bolt-bold-duotone', type: 'usage' as const },
    { label: 'Memory', value: metrics.memory, suffix: '%', icon: 'solar:database-bold-duotone', type: 'usage' as const },
    { label: 'Disk', value: metrics.disk, suffix: '%', icon: 'solar:server-bold-duotone', type: 'usage' as const },
    { label: 'Network', value: metrics.network, suffix: '%', icon: 'solar:wifi-router-bold-duotone', type: 'usage' as const }
  ]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8 }}
      className="premium-card rounded-3xl p-8"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="font-heading text-2xl font-bold text-gray-800 mb-2">System Health</h3>
          <p className="text-gray-600 font-body">Real-time monitoring</p>
        </div>
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="flex items-center space-x-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-xl"
        >
          <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
          <span className="font-heading font-semibold text-sm">ONLINE</span>
        </motion.div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {healthMetrics.map((metric, index) => (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -5, scale: 1.05 }}
            className="text-center group"
          >
            <motion.div
              whileHover={{ rotateX: 360 }}
              transition={{ duration: 1 }}
              className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${getHealthColor(metric.value, metric.type)} shadow-lg mb-3 group-hover:shadow-xl transition-shadow`}
            >
              <Icon icon={metric.icon} className="w-6 h-6 text-white" />
            </motion.div>

            <div>
              <h4 className="font-heading text-xl font-bold text-gray-800 mb-1">
                {metric.value}{metric.suffix}
              </h4>
              <p className="text-xs text-gray-600 font-body font-medium">{metric.label}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}