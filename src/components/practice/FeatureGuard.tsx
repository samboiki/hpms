import React from 'react';
import { usePracticeSettings } from '../../hooks/usePracticeSettings';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { 
  Lock, 
  Crown, 
  MessageSquare, 
  Mail, 
  Stethoscope, 
  FlaskConical, 
  Camera,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';

interface FeatureGuardProps {
  feature: 'vitals_tracking' | 'lab_integration' | 'media_requests' | 'sms_service' | 'email_service';
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgrade?: boolean;
}

const featureConfig = {
  vitals_tracking: {
    name: 'Vitals Tracking',
    icon: Stethoscope,
    description: 'Record and track patient vital signs',
    upgradeMessage: 'Enable vitals tracking to record patient vital signs and monitor health trends.'
  },
  lab_integration: {
    name: 'Lab Integration',
    icon: FlaskConical,
    description: 'Manage lab requests and results',
    upgradeMessage: 'Enable lab integration to manage lab requests, track results, and streamline workflow.'
  },
  media_requests: {
    name: 'Media Requests',
    icon: Camera,
    description: 'Handle medical imaging and media requests',
    upgradeMessage: 'Enable media requests to manage medical imaging, X-rays, and other diagnostic media.'
  },
  sms_service: {
    name: 'SMS Service',
    icon: MessageSquare,
    description: 'Send SMS notifications to patients',
    upgradeMessage: 'Upgrade your SMS plan to send appointment reminders and notifications to patients.'
  },
  email_service: {
    name: 'Email Service',
    icon: Mail,
    description: 'Send email communications to patients',
    upgradeMessage: 'Upgrade your email plan to send patient communications and automated messages.'
  }
};

export const FeatureGuard: React.FC<FeatureGuardProps> = ({ 
  feature, 
  children, 
  fallback, 
  showUpgrade = true 
}) => {
  const { settings, loading, checkFeatureAccess } = usePracticeSettings();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#01b9d4]"></div>
      </div>
    );
  }

  const hasAccess = checkFeatureAccess(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgrade) {
    return null;
  }

  const config = featureConfig[feature];
  const Icon = config.icon;

  // Check if it's a usage limit issue vs feature not enabled
  const isUsageLimitIssue = settings && (
    (feature === 'sms_service' && settings.canUseSMS && settings.smsRemaining <= 0) ||
    (feature === 'email_service' && settings.canUseEmail && settings.emailRemaining <= 0)
  );

  return (
    <Card className="p-6 text-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="p-3 bg-gray-100 rounded-full">
          {isUsageLimitIssue ? (
            <AlertTriangle className="w-8 h-8 text-yellow-600" />
          ) : (
            <Lock className="w-8 h-8 text-gray-400" />
          )}
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {isUsageLimitIssue ? 'Usage Limit Reached' : `${config.name} Not Available`}
          </h3>
          
          {isUsageLimitIssue ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                You've reached your monthly {feature === 'sms_service' ? 'SMS' : 'email'} limit.
              </p>
              {feature === 'sms_service' && settings && (
                <p className="text-xs text-gray-500">
                  Used: {settings.smsUsed} / {settings.smsLimit} SMS
                </p>
              )}
              {feature === 'email_service' && settings && (
                <p className="text-xs text-gray-500">
                  Used: {settings.emailUsed} / {settings.emailLimit} emails
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              {config.upgradeMessage}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {isUsageLimitIssue ? (
            <>
              <Button size="sm" className="bg-[#01b9d4] hover:bg-[#0196be]">
                <Crown className="w-4 h-4 mr-2" />
                Purchase Additional {feature === 'sms_service' ? 'SMS' : 'Emails'}
              </Button>
              <Button variant="outline" size="sm">
                <ExternalLink className="w-4 h-4 mr-2" />
                Upgrade Plan
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" className="bg-[#01b9d4] hover:bg-[#0196be]">
                <Crown className="w-4 h-4 mr-2" />
                Enable Feature
              </Button>
              <Button variant="outline" size="sm">
                <ExternalLink className="w-4 h-4 mr-2" />
                Contact Admin
              </Button>
            </>
          )}
        </div>

        <div className="text-xs text-gray-500">
          Need help? Contact your system administrator to enable this feature or increase limits.
        </div>
      </div>
    </Card>
  );
};

// Utility hook for checking features in components
export const useFeatureAccess = () => {
  const { checkFeatureAccess, settings } = usePracticeSettings();

  return {
    canRecordVitals: checkFeatureAccess('vitals_tracking'),
    canTrackLab: checkFeatureAccess('lab_integration'),
    canTrackMedia: checkFeatureAccess('media_requests'),
    canUseSMS: checkFeatureAccess('sms_service'),
    canUseEmail: checkFeatureAccess('email_service'),
    smsRemaining: settings?.smsRemaining || 0,
    emailRemaining: settings?.emailRemaining || 0,
    settings
  };
};