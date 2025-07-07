import React from 'react';
import { Icon } from '@iconify/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SMSLimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUsage: number;
  monthlyLimit: number;
  billingCycleEnd: string;
  onUpgrade?: () => void;
  onContactSupport?: () => void;
}

export function SMSLimitReachedModal({
  isOpen,
  onClose,
  currentUsage,
  monthlyLimit,
  billingCycleEnd,
  onUpgrade,
  onContactSupport
}: SMSLimitReachedModalProps) {
  const daysUntilReset = Math.ceil(
    (new Date(billingCycleEnd).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Icon icon="solar:danger-circle-bold-duotone" className="h-6 w-6 text-red-600" />
            <DialogTitle>SMS Limit Reached</DialogTitle>
          </div>
          <DialogDescription>
            You've reached your monthly SMS limit and cannot send more messages.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert className="border-red-200 bg-red-50">
            <AlertDescription className="space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">Current Usage:</span>
                <span className="text-red-700 font-bold">{currentUsage} / {monthlyLimit} SMS</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Resets in:</span>
                <span>{daysUntilReset} days</span>
              </div>
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <h4 className="font-medium">What you can do:</h4>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Icon icon="solar:star-bold-duotone" className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium">Upgrade Your Plan</p>
                  <p className="text-sm text-gray-600">Get more SMS credits immediately</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Icon icon="solar:calendar-bold-duotone" className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">Wait for Reset</p>
                  <p className="text-sm text-gray-600">Your limit will reset on {new Date(billingCycleEnd).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Icon icon="solar:phone-bold-duotone" className="h-5 w-5 text-purple-600 mt-0.5" />
                <div>
                  <p className="font-medium">Contact Support</p>
                  <p className="text-sm text-gray-600">Discuss custom plans or overage options</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {onContactSupport && (
            <Button variant="outline" onClick={onContactSupport}>
              <Icon icon="solar:chat-bold-duotone" className="h-4 w-4 mr-2" />
              Contact Support
            </Button>
          )}
          {onUpgrade && (
            <Button onClick={onUpgrade}>
              <Icon icon="solar:rocket-bold-duotone" className="h-4 w-4 mr-2" />
              Upgrade Plan
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}