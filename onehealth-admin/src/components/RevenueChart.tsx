import { motion } from 'framer-motion'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { Icon } from '@iconify/react'
import { useState } from 'react'

interface RevenueChartProps {
  data: Array<{
    month: string
    revenue: number
    invoices: number
  }>
  loading?: boolean
}

export function RevenueChart({ data, loading = false }: RevenueChartProps) {
  const [chartType, setChartType] = useState<'area' | 'bar' | 'line'>('area')

  const formatCurrency = (value: number) => `R${value.toLocaleString()}`

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="text-sm text-indigo-600">
            Revenue: {formatCurrency(payload[0].value)}
          </p>
          <p className="text-sm text-gray-600">
            Invoices: {payload[1]?.value || 0}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Revenue Overview</h3>
          <p className="text-sm text-gray-500 mt-1">Monthly revenue and invoice trends</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChartType('area')}
            className={`p-2 rounded-lg transition-colors ${
              chartType === 'area'
                ? 'bg-indigo-100 text-indigo-600'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Icon icon="solar:chart-bold-duotone" className="w-5 h-5" />
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={`p-2 rounded-lg transition-colors ${
              chartType === 'bar'
                ? 'bg-indigo-100 text-indigo-600'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Icon icon="solar:graph-bold-duotone" className="w-5 h-5" />
          </button>
          <button
            onClick={() => setChartType('line')}
            className={`p-2 rounded-lg transition-colors ${
              chartType === 'line'
                ? 'bg-indigo-100 text-indigo-600'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Icon icon="solar:chart-2-bold-duotone" className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-80 flex items-center justify-center">
          <div className="animate-pulse text-gray-400">
            <Icon icon="solar:chart-bold-duotone" className="w-12 h-12" />
            <p className="text-sm mt-2">Loading chart data...</p>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          {chartType === 'area' ? (
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorInvoices" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="month"
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                yAxisId="revenue"
                orientation="left"
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                tickFormatter={formatCurrency}
              />
              <YAxis
                yAxisId="invoices"
                orientation="right"
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                yAxisId="revenue"
                type="monotone"
                dataKey="revenue"
                stroke="#6366f1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRevenue)"
                name="Revenue"
              />
              <Area
                yAxisId="invoices"
                type="monotone"
                dataKey="invoices"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorInvoices)"
                name="Invoices"
              />
            </AreaChart>
          ) : chartType === 'bar' ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="month"
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                yAxisId="revenue"
                orientation="left"
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                tickFormatter={formatCurrency}
              />
              <YAxis
                yAxisId="invoices"
                orientation="right"
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar
                yAxisId="revenue"
                dataKey="revenue"
                fill="#6366f1"
                radius={[8, 8, 0, 0]}
                name="Revenue"
              />
              <Bar
                yAxisId="invoices"
                dataKey="invoices"
                fill="#10b981"
                radius={[8, 8, 0, 0]}
                name="Invoices"
              />
            </BarChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="month"
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <YAxis
                yAxisId="revenue"
                orientation="left"
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                tickFormatter={formatCurrency}
              />
              <YAxis
                yAxisId="invoices"
                orientation="right"
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                yAxisId="revenue"
                type="monotone"
                dataKey="revenue"
                stroke="#6366f1"
                strokeWidth={3}
                dot={{ fill: '#6366f1', r: 4 }}
                name="Revenue"
              />
              <Line
                yAxisId="invoices"
                type="monotone"
                dataKey="invoices"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: '#10b981', r: 4 }}
                name="Invoices"
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Revenue</p>
          <p className="text-lg font-bold text-gray-900 mt-1">
            {formatCurrency(data.reduce((sum, d) => sum + d.revenue, 0))}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Avg Monthly</p>
          <p className="text-lg font-bold text-gray-900 mt-1">
            {formatCurrency(data.reduce((sum, d) => sum + d.revenue, 0) / (data.length || 1))}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Invoices</p>
          <p className="text-lg font-bold text-gray-900 mt-1">
            {data.reduce((sum, d) => sum + d.invoices, 0)}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

// Practice Revenue Pie Chart Component
interface PracticeRevenueChartProps {
  data: Array<{
    name: string
    revenue: number
  }>
  loading?: boolean
}

export function PracticeRevenueChart({ data, loading = false }: PracticeRevenueChartProps) {
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="text-sm font-semibold text-gray-900">{payload[0].name}</p>
          <p className="text-sm text-indigo-600">
            Revenue: R{payload[0].value.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">
            {((payload[0].value / data.reduce((s, d) => s + d.revenue, 0)) * 100).toFixed(1)}% of total
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
    >
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Revenue by Practice</h3>
        <p className="text-sm text-gray-500 mt-1">Distribution of revenue across practices</p>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-pulse text-gray-400">
            <Icon icon="solar:pie-chart-2-bold-duotone" className="w-12 h-12" />
            <p className="text-sm mt-2">Loading chart data...</p>
          </div>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => entry.name.split(' ')[0]}
                outerRadius={80}
                fill="#8884d8"
                dataKey="revenue"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="mt-4 space-y-2">
            {data.map((practice, index) => (
              <div key={practice.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm text-gray-700">{practice.name}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">
                  R{practice.revenue.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  )
}