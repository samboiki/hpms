'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Plus, Filter, Download, Edit, Trash2, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Practice {
  id: string
  name: string
  practice_type: string
  practice_subtypes: string[]
  city: string
}

interface Tariff {
  id: string
  practice_id: string
  code: string
  price: number
  namaf_prace_2025: string
  full_description: string
  practice_type: string
  category: string
  subcategory: string
  is_active: boolean
  practice?: Practice
}

export default function TariffsPage() {
  const [tariffs, setTariffs] = useState<Tariff[]>([])
  const [practices, setPractices] = useState<Practice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPractice, setSelectedPractice] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Load practices
      const { data: practicesData } = await supabase
        .from('practices')
        .select('id, name, practice_type, practice_subtypes, city')
        .order('name')

      if (practicesData) {
        setPractices(practicesData)
      }

      // Load tariffs with practice info
      const { data: tariffsData } = await supabase
        .from('practice_tariffs')
        .select(`
          *,
          practice:practices(id, name, practice_type, practice_subtypes, city)
        `)
        .order('code')

      if (tariffsData) {
        setTariffs(tariffsData)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTariffs = tariffs.filter(tariff => {
    const matchesSearch = 
      tariff.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tariff.namaf_prace_2025.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tariff.full_description?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesPractice = selectedPractice === 'all' || tariff.practice_id === selectedPractice
    const matchesCategory = selectedCategory === 'all' || tariff.category === selectedCategory

    return matchesSearch && matchesPractice && matchesCategory
  })

  const categories = [...new Set(tariffs.map(t => t.category).filter(Boolean))]
  const totalRevenue = filteredTariffs.reduce((sum, tariff) => sum + tariff.price, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-onehealth-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-poppins font-bold text-gray-900">Tariff Management</h1>
          <p className="text-sm font-montserrat text-gray-600 mt-1">
            Manage pricing and service codes across all practices
          </p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Tariff
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-onehealth-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-onehealth-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-montserrat text-gray-600">Total Tariffs</p>
              <p className="text-lg font-poppins font-semibold text-gray-900">{filteredTariffs.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-montserrat text-gray-600">Avg. Price</p>
              <p className="text-lg font-poppins font-semibold text-gray-900">
                N${(totalRevenue / Math.max(filteredTariffs.length, 1)).toFixed(0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-montserrat text-gray-600">Categories</p>
              <p className="text-lg font-poppins font-semibold text-gray-900">{categories.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-montserrat text-gray-600">Practices</p>
              <p className="text-lg font-poppins font-semibold text-gray-900">{practices.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by code, name, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <select
            value={selectedPractice}
            onChange={(e) => setSelectedPractice(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-onehealth-500"
          >
            <option value="all">All Practices</option>
            {practices.map((practice) => (
              <option key={practice.id} value={practice.id}>
                {practice.name}
              </option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-onehealth-500"
          >
            <option value="all">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Tariffs Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-poppins font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-poppins font-medium text-gray-500 uppercase tracking-wider">
                  Service Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-poppins font-medium text-gray-500 uppercase tracking-wider">
                  Practice
                </th>
                <th className="px-6 py-3 text-left text-xs font-poppins font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-poppins font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-poppins font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-poppins font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTariffs.map((tariff) => (
                <tr key={tariff.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-montserrat font-medium text-gray-900">
                    {tariff.code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-montserrat font-medium text-gray-900">
                        {tariff.namaf_prace_2025}
                      </div>
                      {tariff.full_description && (
                        <div className="text-sm font-montserrat text-gray-500 truncate max-w-xs">
                          {tariff.full_description}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-montserrat font-medium text-gray-900">
                        {tariff.practice?.name}
                      </div>
                      <div className="text-sm font-montserrat text-gray-500">
                        {tariff.practice?.practice_type} • {tariff.practice?.city}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-montserrat font-medium bg-gray-100 text-gray-800 rounded-full">
                      {tariff.category}
                    </span>
                    {tariff.subcategory && (
                      <div className="text-xs font-montserrat text-gray-500 mt-1">
                        {tariff.subcategory}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-montserrat font-medium text-gray-900">
                    N${tariff.price.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-montserrat font-medium rounded-full ${
                      tariff.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {tariff.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-900">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTariffs.length === 0 && (
          <div className="text-center py-12">
            <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-poppins font-medium text-gray-900">No tariffs found</h3>
            <p className="mt-1 text-sm font-montserrat text-gray-500">
              Try adjusting your search or filter criteria.
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}