'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageSquare, RefreshCw, DollarSign, AlertCircle, CheckCircle, Send } from 'lucide-react'
import { toast } from 'react-hot-toast'

interface SMSBalance {
  credits: number
  lastUpdated: string
  error?: string
}

export function SMSBalanceWidget() {
  const [balance, setBalance] = useState<SMSBalance | null>(null)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)

  const checkBalance = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'getBalance'
        })
      })

      const result = await response.json()
      
      if (result.success && result.credits !== undefined) {
        setBalance({
          credits: result.credits,
          lastUpdated: new Date().toISOString(),
          error: undefined
        })
        toast.success(`Balance updated: ${result.credits} credits`)
      } else {
        setBalance({
          credits: 0,
          lastUpdated: new Date().toISOString(),
          error: result.error || 'Failed to fetch balance'
        })
        toast.error(result.error || 'Failed to fetch balance')
      }
    } catch (error) {
      console.error('Balance check error:', error)
      setBalance({
        credits: 0,
        lastUpdated: new Date().toISOString(),
        error: 'Network error'
      })
      toast.error('Network error checking balance')
    } finally {
      setLoading(false)
    }
  }

  const sendTestSMS = async () => {
    setTesting(true)
    try {
      const testNumber = '+264812222331'
      const testMessage = `🏥 Test SMS from OneHealth Admin Portal. Time: ${new Date().toLocaleString()}. Testing SMS portal balance update...`
      
      toast.loading('Sending test SMS...')
      
      const response = await fetch('/api/admin/sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sendTestSMS',
          data: {
            to: testNumber,
            message: testMessage,
            practiceId: null // Admin test SMS
          }
        })
      })

      const result = await response.json()
      
      if (result.success) {
        toast.dismiss()
        toast.success(`✅ Test SMS sent successfully! Message ID: ${result.messageId}`)
        
        if (result.remainingCredits) {
          setBalance(prev => prev ? {
            ...prev,
            credits: result.remainingCredits,
            lastUpdated: new Date().toISOString()
          } : null)
        }
        
        // Check balance after sending to get updated info
        setTimeout(() => {
          checkBalance()
        }, 2000)
      } else {
        toast.dismiss()
        toast.error(`❌ Test SMS failed: ${result.error}`)
      }
    } catch (error) {
      toast.dismiss()
      toast.error('❌ Network error sending test SMS')
      console.error('Test SMS error:', error)
    } finally {
      setTesting(false)
    }
  }

  useEffect(() => {
    // Check balance on component mount
    checkBalance()
    
    // Set up auto-refresh every 5 minutes
    const interval = setInterval(checkBalance, 5 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [])

  const getBalanceStatus = () => {
    if (!balance) return { color: 'text-gray-500', icon: RefreshCw, text: 'Loading...' }
    
    if (balance.error) {
      return { color: 'text-red-600', icon: AlertCircle, text: 'Error' }
    }
    
    if (balance.credits < 50) {
      return { color: 'text-red-600', icon: AlertCircle, text: 'Low Balance' }
    }
    
    if (balance.credits < 200) {
      return { color: 'text-yellow-600', icon: AlertCircle, text: 'Medium' }
    }
    
    return { color: 'text-green-600', icon: CheckCircle, text: 'Good' }
  }

  const status = getBalanceStatus()
  const StatusIcon = status.icon

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">SMS Portal Balance</CardTitle>
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Balance Display */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold">
                {balance ? balance.credits.toLocaleString() : '---'}
              </div>
              <p className="text-xs text-muted-foreground">
                Credits available
              </p>
            </div>
            <div className={`flex items-center space-x-1 ${status.color}`}>
              <StatusIcon className="h-4 w-4" />
              <span className="text-sm font-medium">{status.text}</span>
            </div>
          </div>

          {/* Error Display */}
          {balance?.error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-sm text-red-700">{balance.error}</p>
            </div>
          )}

          {/* Balance Info */}
          {balance && !balance.error && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Cost per SMS</p>
                <p className="font-medium">1 credit (~$0.05)</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Updated</p>
                <p className="font-medium">
                  {new Date(balance.lastUpdated).toLocaleTimeString()}
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={checkBalance}
              disabled={loading}
              className="flex-1"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={sendTestSMS}
              disabled={testing || !balance || balance.error !== undefined}
              className="flex-1"
            >
              <Send className="h-4 w-4 mr-1" />
              Test SMS
            </Button>
          </div>

          {/* Quick Stats */}
          {balance && !balance.error && (
            <div className="border-t pt-3">
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>Estimated SMSes:</span>
                  <span className="font-medium">{balance.credits}</span>
                </div>
                <div className="flex justify-between">
                  <span>Est. value:</span>
                  <span className="font-medium">${(balance.credits * 0.05).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}