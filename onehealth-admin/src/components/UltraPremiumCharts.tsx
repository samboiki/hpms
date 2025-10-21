import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion'
import { useEffect, useState, useMemo } from 'react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  RadialBarChart,
  RadialBar,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Bar,
  Line
} from 'recharts'
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar'
import 'react-circular-progressbar/dist/styles.css'
import { Icon } from '@iconify/react'
import * as d3 from 'd3'

// Advanced Animated Revenue Chart with Glassmorphism
interface UltraRevenueChartProps {
  data: Array<{
    month: string
    revenue: number
    invoices: number
    growth?: number
  }>
  loading?: boolean
}

export function UltraRevenueChart({ data, loading = false }: UltraRevenueChartProps) {
  const [activeIndex, setActiveIndex] = useState(-1)
  const [animationPercent, setAnimationPercent] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setAnimationPercent(100), 100)
    return () => clearTimeout(timer)
  }, [])

  const maxRevenue = Math.max(...data.map(d => d.revenue))
  const enhancedData = data.map((item, index) => ({
    ...item,
    normalizedRevenue: (item.revenue / maxRevenue) * 100,
    index
  }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="premium-card rounded-2xl p-6 border border-white/30 backdrop-blur-xl"
          style={{
            background: 'linear-gradient(145deg, rgba(255,255,255,0.95), rgba(255,255,255,0.85))',
            boxShadow: '0 20px 40px rgba(31, 38, 135, 0.37)'
          }}
        >
          <h4 className="font-heading text-lg font-bold text-gray-800 mb-3">{label}</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 flex items-center">
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 mr-2" />
                Revenue
              </span>
              <span className="font-bold text-lg text-gradient">R{payload[0].value.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 flex items-center">
                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-500 to-teal-500 mr-2" />
                Invoices
              </span>
              <span className="font-bold text-lg text-green-600">{payload[1]?.value || 0}</span>
            </div>
          </div>
        </motion.div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="chart-container flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-white/70 font-body">Loading mesmerizing data...</p>
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, type: 'spring', bounce: 0.3 }}
      className="chart-container group"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="font-heading text-2xl font-bold text-gray-800 mb-2">Revenue Analytics</h3>
          <p className="text-gray-600 font-body">Monthly performance with growth trends</p>
        </div>
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-2 rounded-xl"
        >
          <Icon icon="solar:chart-square-bold-duotone" className="w-5 h-5" />
          <span className="font-heading font-semibold">Live Data</span>
        </motion.div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={enhancedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#667eea" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#764ba2" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="invoiceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#43e97b" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#38f9d7" stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6b7280', fontFamily: 'Montserrat', fontSize: 12 }}
          />
          <YAxis
            yAxisId="revenue"
            orientation="left"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6b7280', fontFamily: 'Montserrat', fontSize: 12 }}
            tickFormatter={(value) => `R${value.toLocaleString()}`}
          />
          <YAxis
            yAxisId="invoices"
            orientation="right"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6b7280', fontFamily: 'Montserrat', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            yAxisId="revenue"
            type="monotone"
            dataKey="revenue"
            stroke="#667eea"
            strokeWidth={3}
            fill="url(#revenueGradient)"
            fillOpacity={1}
            animationBegin={0}
            animationDuration={2000}
            animationEasing="ease-out"
          />
          <Bar
            yAxisId="invoices"
            dataKey="invoices"
            fill="url(#invoiceGradient)"
            radius={[8, 8, 0, 0]}
            animationBegin={500}
            animationDuration={1500}
          />
          <Line
            yAxisId="revenue"
            type="monotone"
            dataKey="revenue"
            stroke="#764ba2"
            strokeWidth={2}
            dot={{ fill: '#764ba2', strokeWidth: 2, r: 6 }}
            activeDot={{ r: 8, fill: '#667eea', stroke: 'white', strokeWidth: 3 }}
            animationBegin={1000}
            animationDuration={1000}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Statistics Bar */}
      <div className="grid grid-cols-3 gap-6 mt-8 pt-6 border-t border-white/20">
        {[
          { label: 'Total Revenue', value: `R${data.reduce((sum, d) => sum + d.revenue, 0).toLocaleString()}`, color: 'from-blue-500 to-purple-500' },
          { label: 'Avg Monthly', value: `R${Math.round(data.reduce((sum, d) => sum + d.revenue, 0) / data.length).toLocaleString()}`, color: 'from-green-500 to-teal-500' },
          { label: 'Growth Trend', value: '+12.5%', color: 'from-pink-500 to-red-500' }
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 + 0.5 }}
            className="text-center"
          >
            <div className={`inline-flex items-center px-4 py-2 rounded-xl bg-gradient-to-r ${stat.color} text-white mb-2`}>
              <span className="font-heading font-bold text-lg">{stat.value}</span>
            </div>
            <p className="text-sm text-gray-600 font-body">{stat.label}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

// Ultra-Premium Radial Progress Chart
interface RadialMetricProps {
  title: string
  value: number
  maxValue: number
  color: string
  subtitle?: string
  icon: string
}

export function UltraRadialMetric({ title, value, maxValue, color, subtitle, icon }: RadialMetricProps) {
  const [animatedValue, setAnimatedValue] = useState(0)
  const percentage = (value / maxValue) * 100

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValue(percentage)
    }, 200)
    return () => clearTimeout(timer)
  }, [percentage])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, type: 'spring' }}
      whileHover={{ scale: 1.05, y: -5 }}
      className="metric-card-ultra group cursor-pointer"
    >
      <div className="flex items-center justify-between mb-6">
        <div className={`p-4 rounded-2xl bg-gradient-to-br ${color} shadow-lg`}>
          <Icon icon={icon} className="w-8 h-8 text-white" />
        </div>
        <div className="text-right">
          <h3 className="font-heading text-3xl font-bold text-gray-800">{value.toLocaleString()}</h3>
          <p className="text-sm text-gray-600 font-body">{title}</p>
        </div>
      </div>

      <div className="flex items-center justify-center">
        <div className="relative w-32 h-32">
          <CircularProgressbar
            value={animatedValue}
            text={`${Math.round(percentage)}%`}
            styles={buildStyles({
              pathColor: color.includes('blue') ? '#667eea' : color.includes('green') ? '#43e97b' : '#f093fb',
              textColor: '#374151',
              trailColor: 'rgba(255,255,255,0.3)',
              backgroundColor: 'transparent',
              pathTransitionDuration: 2,
              textSize: '16px'
            })}
          />
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 to-transparent" />
        </div>
      </div>

      {subtitle && (
        <p className="text-center text-sm text-gray-600 mt-4 font-body">{subtitle}</p>
      )}

      <motion.div
        className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
        layoutId="hover-effect"
      />
    </motion.div>
  )
}

// Advanced Heatmap Visualization
interface HeatmapData {
  day: string
  hour: number
  value: number
}

interface UltraHeatmapProps {
  data: HeatmapData[]
  title: string
}

export function UltraHeatmap({ data, title }: UltraHeatmapProps) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const maxValue = Math.max(...data.map(d => d.value))

  const getColor = (value: number) => {
    const intensity = value / maxValue
    if (intensity > 0.8) return 'from-red-500 to-pink-500'
    if (intensity > 0.6) return 'from-orange-500 to-red-400'
    if (intensity > 0.4) return 'from-yellow-500 to-orange-400'
    if (intensity > 0.2) return 'from-green-500 to-yellow-400'
    return 'from-blue-500 to-green-400'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="chart-container"
    >
      <div className="mb-8">
        <h3 className="font-heading text-2xl font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-600 font-body">Activity patterns throughout the week</p>
      </div>

      <div className="overflow-x-auto">
        <div className="grid grid-cols-25 gap-1 min-w-[800px]">
          {/* Header Row */}
          <div className="col-span-1" />
          {hours.map(hour => (
            <div key={hour} className="text-center text-xs text-gray-600 font-body p-1">
              {hour}h
            </div>
          ))}

          {/* Data Rows */}
          {days.map((day, dayIndex) => (
            <>
              <div key={day} className="flex items-center text-sm text-gray-700 font-body font-medium pr-2">
                {day}
              </div>
              {hours.map(hour => {
                const dataPoint = data.find(d => d.day === day && d.hour === hour)
                const value = dataPoint?.value || 0
                const intensity = value / maxValue

                return (
                  <motion.div
                    key={`${day}-${hour}`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: (dayIndex * 24 + hour) * 0.002 }}
                    whileHover={{ scale: 1.2, zIndex: 10 }}
                    className={`aspect-square rounded-lg bg-gradient-to-br ${getColor(value)} cursor-pointer relative group`}
                    style={{ opacity: Math.max(0.1, intensity) }}
                  >
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs font-bold text-white">{value}</span>
                    </div>
                  </motion.div>
                )
              })}
            </>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center mt-8 space-x-4">
        <span className="text-sm text-gray-600 font-body">Low</span>
        <div className="flex space-x-1">
          {[0.2, 0.4, 0.6, 0.8, 1.0].map((intensity, index) => (
            <div
              key={index}
              className={`w-4 h-4 rounded bg-gradient-to-br ${getColor(intensity * maxValue)}`}
              style={{ opacity: intensity }}
            />
          ))}
        </div>
        <span className="text-sm text-gray-600 font-body">High</span>
      </div>
    </motion.div>
  )
}

// 3D Perspective Metric Cards
interface Metric3DProps {
  title: string
  value: string | number
  change: number
  icon: string
  color: string
}

export function UltraMetric3D({ title, value, change, icon, color }: Metric3DProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, rotateY: -15 }}
      animate={{ opacity: 1, rotateY: 0 }}
      whileHover={{
        rotateY: 5,
        rotateX: 5,
        scale: 1.02,
        transition: { duration: 0.3 }
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="metric-card-ultra perspective-1000 transform-gpu cursor-pointer"
      style={{
        transformStyle: 'preserve-3d',
        perspective: '1000px'
      }}
    >
      {/* Background layers for depth */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/60 to-white/30 transform translate-z-[-10px]" />
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/40 to-white/20 transform translate-z-[-20px]" />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-6">
          <motion.div
            animate={{ rotateY: isHovered ? 360 : 0 }}
            transition={{ duration: 0.8 }}
            className={`p-4 rounded-2xl bg-gradient-to-br ${color} shadow-xl`}
          >
            <Icon icon={icon} className="w-8 h-8 text-white" />
          </motion.div>

          <div className="text-right">
            <motion.h3
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="font-heading text-4xl font-bold text-gray-800"
            >
              {typeof value === 'number' ? value.toLocaleString() : value}
            </motion.h3>
            <p className="text-sm text-gray-600 font-body mt-1">{title}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <motion.div
            animate={{ x: isHovered ? 5 : 0 }}
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
              change >= 0
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            <Icon
              icon={change >= 0 ? 'solar:arrow-up-bold' : 'solar:arrow-down-bold'}
              className="w-4 h-4 mr-1"
            />
            {Math.abs(change)}%
          </motion.div>

          <span className="text-xs text-gray-500 font-body">vs last month</span>
        </div>
      </div>

      {/* Floating elements */}
      <motion.div
        animate={{
          y: isHovered ? -10 : 0,
          opacity: isHovered ? 1 : 0
        }}
        className="absolute top-4 right-4 w-6 h-6 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full shadow-lg"
      />
      <motion.div
        animate={{
          y: isHovered ? -5 : 0,
          opacity: isHovered ? 0.7 : 0
        }}
        className="absolute bottom-4 left-4 w-4 h-4 bg-gradient-to-br from-pink-400 to-red-500 rounded-full shadow-md"
      />
    </motion.div>
  )
}

// Advanced Donut Chart with Animations
interface DonutChartProps {
  data: Array<{ name: string; value: number; color: string }>
  title: string
  centerMetric?: { label: string; value: string }
}

export function UltraDonutChart({ data, title, centerMetric }: DonutChartProps) {
  const [activeIndex, setActiveIndex] = useState(-1)
  const total = data.reduce((sum, item) => sum + item.value, 0)

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="premium-card rounded-xl p-4 backdrop-blur-xl"
        >
          <div className="flex items-center space-x-3">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: data.color }}
            />
            <div>
              <p className="font-heading font-semibold text-gray-800">{data.name}</p>
              <p className="text-sm text-gray-600">
                {data.value.toLocaleString()} ({((data.value / total) * 100).toFixed(1)}%)
              </p>
            </div>
          </div>
        </motion.div>
      )
    }
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
      className="chart-container"
    >
      <div className="mb-8">
        <h3 className="font-heading text-2xl font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-600 font-body">Distribution overview</p>
      </div>

      <div className="relative">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              animationBegin={0}
              animationDuration={1500}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(-1)}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  stroke={activeIndex === index ? '#ffffff' : 'transparent'}
                  strokeWidth={activeIndex === index ? 3 : 0}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center Metric */}
        {centerMetric && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="font-heading text-3xl font-bold text-gray-800">{centerMetric.value}</p>
              <p className="text-sm text-gray-600 font-body">{centerMetric.label}</p>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        {data.map((item, index) => (
          <motion.div
            key={item.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center space-x-3 p-3 rounded-xl bg-white/50 hover:bg-white/70 transition-all cursor-pointer"
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(-1)}
          >
            <div
              className="w-4 h-4 rounded-full shadow-sm"
              style={{ backgroundColor: item.color }}
            />
            <div className="flex-1">
              <p className="font-heading font-medium text-gray-800">{item.name}</p>
              <p className="text-xs text-gray-600">{item.value.toLocaleString()}</p>
            </div>
            <span className="text-sm font-bold text-gray-700">
              {((item.value / total) * 100).toFixed(1)}%
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}