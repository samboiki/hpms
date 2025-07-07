import React from 'react';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

interface SMSLimitWarningProps {
  currentUsage: number;
  monthlyLimit: number;
  onUpgrade?: () => void;
  onViewUsage?: () => void;
}

export function SMSLimitWarning({
  currentUsage,
  monthlyLimit,
  onUpgrade,
  onViewUsage
}: SMSLimitWarningProps) {
  const usagePercentage = (currentUsage / monthlyLimit) * 100;
  const remaining = monthlyLimit - currentUsage;
  const isExhausted = remaining <= 0;
  const isNearLimit = usagePercentage >= 80;

  if (!isNearLimit && !isExhausted) return null;

  return (
    <Alert className={isExhausted ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50'}>
      <Icon 
        icon={isExhausted ? "solar:danger-bold-duotone" : "solar:info-circle-bold-duotone"} 
        className={`h-4 w-4 ${isExhausted ? 'text-red-600' : 'text-yellow-600'}`}
      />
      <AlertTitle className={isExhausted ? 'text-red-800' : 'text-yellow-800'}>
        {isExhausted ? 'SMS Limit Reached' : 'SMS Limit Warning'}
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p className={isExhausted ? 'text-red-700' : 'text-yellow-700'}>
          {isExhausted 
            ? 'You have reached your monthly SMS limit. No more SMS messages can be sent until your limit resets or you upgrade your plan.'
            : `You have used ${currentUsage} of ${monthlyLimit} SMS messages this month (${Math.round(usagePercentage)}%).`
          }
        </p>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>SMS Usage</span>
            <span>{currentUsage} / {monthlyLimit}</span>
          </div>
          <Progress 
            value={usagePercentage} 
            className={`h-2 ${isExhausted ? 'bg-red-200' : 'bg-yellow-200'}`}
          />
        </div>

        <div className="flex gap-2 mt-4">
          {onUpgrade && (
            <Button 
              size="sm" 
              variant={isExhausted ? "default" : "outline"}
              onClick={onUpgrade}
              className="gap-2"
            >
              <Icon icon="solar:rocket-bold-duotone" className="h-4 w-4" />
              Upgrade Plan
            </Button>
          )}
          {onViewUsage && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={onViewUsage}
              className="gap-2"
            >
              <Icon icon="solar:chart-bold-duotone" className="h-4 w-4" />
              View Usage
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}