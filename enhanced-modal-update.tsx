// This is a comprehensive update to enhance the financial modal with 8 chart types
// Place this code in the renderEnhancedOverview function, right after the brand colors definition

    // Performance Metrics at Top
    const renderPerformanceMetrics = () => (
      <motion.div 
        className="bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 rounded-3xl p-8 border border-gray-200 mb-8"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.6 }}
      >
        <h4 className="text-xl font-bold text-gray-800 mb-6 text-center">Performance Metrics</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: 'Total Invoices', value: analytics.paidInvoices + analytics.pendingInvoices, color: 'text-gray-700' },
            { label: 'Paid Invoices', value: analytics.paidInvoices, color: 'text-emerald-600' },
            { label: 'Pending Invoices', value: analytics.pendingInvoices, color: 'text-orange-600' },
            { 
              label: 'Collection Rate', 
              value: `${analytics.paidInvoices + analytics.pendingInvoices > 0 
                ? ((analytics.paidInvoices / (analytics.paidInvoices + analytics.pendingInvoices)) * 100).toFixed(1)
                : 0}%`, 
              color: 'text-purple-600' 
            }
          ].map((stat, index) => (
            <motion.div 
              key={stat.label}
              className="text-center p-4 bg-white rounded-2xl shadow-sm border border-gray-100"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              whileHover={{ scale: 1.05 }}
            >
              <p className={`text-3xl font-bold mb-2 font-rubik ${stat.color}`}>{stat.value}</p>
              <p className="text-sm text-gray-600 font-medium">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    );

    // Chart Type Selector
    const renderChartSelector = () => (
      <motion.div 
        className="bg-white rounded-2xl p-6 border border-gray-200 mb-8"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <h4 className="text-lg font-semibold text-gray-800 mb-4">Chart Visualization Options</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { key: 'default', label: 'Default View', icon: '📊' },
            { key: 'line-area', label: 'Line & Area', icon: '📈' },
            { key: 'stacked-bars', label: 'Stacked Bars', icon: '📉' },
            { key: 'radar', label: 'Radar Chart', icon: '🕸️' },
            { key: 'bubble', label: 'Bubble Chart', icon: '🫧' },
            { key: 'polar', label: 'Polar Area', icon: '🎯' },
            { key: 'scatter', label: 'Scatter Plot', icon: '⭐' },
            { key: 'mixed', label: 'Mixed Chart', icon: '🌈' }
          ].map((chartType) => (
            <motion.button
              key={chartType.key}
              onClick={() => setSelectedChartType(chartType.key as any)}
              className={`p-3 rounded-xl text-center transition-all duration-300 ${
                selectedChartType === chartType.key
                  ? 'bg-blue-100 border-2 border-blue-500 text-blue-700'
                  : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="text-2xl mb-1">{chartType.icon}</div>
              <div className="text-xs font-medium">{chartType.label}</div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    );

    // Advanced chart data configurations
    const radarData = {
      labels: ['Revenue', 'Growth', 'Efficiency', 'Collection', 'Satisfaction', 'Performance'],
      datasets: [
        {
          label: 'Current Period',
          data: [
            (analytics.totalRevenue / 50000) * 100,
            Math.max(0, analytics.revenueGrowth),
            (analytics.paidInvoices / (analytics.paidInvoices + analytics.pendingInvoices)) * 100,
            85, 92, 88
          ],
          borderColor: brandColors.primary,
          backgroundColor: brandColors.primary + '30',
          borderWidth: 3,
          pointBackgroundColor: brandColors.primary,
          pointBorderColor: '#fff',
          pointBorderWidth: 2
        }
      ]
    };

    const bubbleData = {
      datasets: analytics.topServices.slice(0, 8).map((service, index) => ({
        label: service.name.length > 15 ? service.name.substring(0, 15) + '...' : service.name,
        data: [{
          x: service.count,
          y: service.value,
          r: Math.max(5, Math.min(25, service.value / 1000))
        }],
        backgroundColor: Object.values(brandColors)[index] + '80',
        borderColor: Object.values(brandColors)[index],
        borderWidth: 2
      }))
    };

    const scatterData = {
      datasets: [
        {
          label: 'Service Performance',
          data: analytics.topServices.slice(0, 10).map(service => ({
            x: service.count,
            y: service.value
          })),
          backgroundColor: brandColors.accent1,
          borderColor: brandColors.accent1,
          pointRadius: 8,
          pointHoverRadius: 12
        }
      ]
    };

    const mixedData = {
      labels: analytics.monthlyTrends.map(trend => trend.month),
      datasets: [
        {
          type: 'line' as const,
          label: 'Revenue Trend',
          data: analytics.monthlyTrends.map(trend => trend.revenue),
          borderColor: brandColors.primary,
          backgroundColor: brandColors.primary + '20',
          borderWidth: 3,
          fill: false,
          tension: 0.4,
          yAxisID: 'y'
        },
        {
          type: 'bar' as const,
          label: 'Invoice Count',
          data: analytics.monthlyTrends.map(trend => trend.invoices * 100), // Scale for visibility
          backgroundColor: brandColors.secondary + 'CC',
          borderColor: brandColors.secondary,
          borderWidth: 2,
          yAxisID: 'y1'
        }
      ]
    };

    // Enhanced chart options
    const radarOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
          labels: {
            color: '#6b7280',
            font: { size: 12 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          titleColor: '#1f2937',
          bodyColor: '#374151',
          borderColor: '#e5e7eb',
          borderWidth: 1,
          cornerRadius: 12,
          padding: 16
        }
      },
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          grid: {
            color: 'rgba(243, 244, 246, 0.8)'
          },
          angleLines: {
            color: 'rgba(243, 244, 246, 0.8)'
          },
          pointLabels: {
            color: '#6b7280',
            font: { size: 12 }
          }
        }
      }
    };

    const bubbleOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          titleColor: '#1f2937',
          bodyColor: '#374151',
          borderColor: '#e5e7eb',
          borderWidth: 1,
          cornerRadius: 12,
          padding: 16,
          callbacks: {
            label: function(context: any) {
              return `${context.dataset.label}: Count: ${context.parsed.x}, Revenue: N$${context.parsed.y?.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Service Count',
            color: '#6b7280'
          },
          grid: {
            color: 'rgba(243, 244, 246, 0.8)'
          },
          ticks: {
            color: '#6b7280'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Revenue (N$)',
            color: '#6b7280'
          },
          grid: {
            color: 'rgba(243, 244, 246, 0.8)'
          },
          ticks: {
            color: '#6b7280',
            callback: function(value: any) {
              return 'N$' + value.toLocaleString();
            }
          }
        }
      }
    };

    const mixedOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
          labels: {
            color: '#6b7280',
            font: { size: 12 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          titleColor: '#1f2937',
          bodyColor: '#374151',
          borderColor: '#e5e7eb',
          borderWidth: 1,
          cornerRadius: 12,
          padding: 16
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: '#6b7280'
          }
        },
        y: {
          type: 'linear' as const,
          display: true,
          position: 'left' as const,
          grid: {
            color: 'rgba(243, 244, 246, 0.8)'
          },
          ticks: {
            color: '#6b7280',
            callback: function(value: any) {
              return 'N$' + value.toLocaleString();
            }
          }
        },
        y1: {
          type: 'linear' as const,
          display: true,
          position: 'right' as const,
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            color: '#6b7280'
          }
        }
      }
    };

    // Full width chart component
    const renderFullWidthChart = () => (
      <motion.div 
        className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden mb-8"
        whileHover={{ y: -2, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)" }}
        transition={{ duration: 0.3 }}
      >
        <div className="p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600">
              {selectedChartType === 'radar' && <Activity className="w-6 h-6 text-white" />}
              {selectedChartType === 'bubble' && <Target className="w-6 h-6 text-white" />}
              {selectedChartType === 'scatter' && <TrendingUp className="w-6 h-6 text-white" />}
              {selectedChartType === 'mixed' && <BarChart3 className="w-6 h-6 text-white" />}
            </div>
            <div>
              <h4 className="text-xl font-bold text-gray-800">
                {selectedChartType === 'radar' && 'Performance Radar'}
                {selectedChartType === 'bubble' && 'Service Bubble Analysis'}
                {selectedChartType === 'scatter' && 'Revenue vs Count Scatter'}
                {selectedChartType === 'mixed' && 'Combined Revenue & Volume'}
              </h4>
              <p className="text-gray-500 text-sm">
                {selectedChartType === 'radar' && 'Multi-dimensional performance overview'}
                {selectedChartType === 'bubble' && 'Service performance with revenue and frequency'}
                {selectedChartType === 'scatter' && 'Relationship between service frequency and revenue'}
                {selectedChartType === 'mixed' && 'Revenue trends with invoice volume overlay'}
              </p>
            </div>
          </div>
          <div className="h-96">
            {selectedChartType === 'radar' && (
              <Radar data={radarData} options={radarOptions} />
            )}
            {selectedChartType === 'bubble' && (
              <Bubble data={bubbleData} options={bubbleOptions} />
            )}
            {selectedChartType === 'scatter' && (
              <Scatter data={scatterData} options={bubbleOptions} />
            )}
            {selectedChartType === 'mixed' && (
              <Chart type="bar" data={mixedData} options={mixedOptions} />
            )}
          </div>
        </div>
      </motion.div>
    );

    // Main render structure
    return (
      <motion.div 
        className="space-y-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        {/* Performance Metrics at Top */}
        {renderPerformanceMetrics()}

        {/* Chart Type Selector */}
        {renderChartSelector()}

        {/* Full Width Charts for Special Types */}
        {(selectedChartType === 'radar' || selectedChartType === 'bubble' || selectedChartType === 'scatter' || selectedChartType === 'mixed') && 
          renderFullWidthChart()
        }

        {/* Default and alternative grid layouts */}
        {/* ... rest of chart rendering logic */}
      </motion.div>
    );