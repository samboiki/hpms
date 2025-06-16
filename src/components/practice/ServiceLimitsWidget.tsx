import React from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { usePracticeSettings } from '../../hooks/usePracticeSettings';
import { 
  MessageSquare, 
  Mail, 
  Users, 
  UserPlus, 
  AlertTriangle, 
  CheckCircle,
  XCircle,
  Activity,
  Stethoscope,
  FlaskConical,
  Camera
} from 'lucide-react';

export const ServiceLimitsWidget: React.FC = () => {
  const { settings, loading } = usePracticeSettings();

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#01b9d4]"></div>
        </div>
      </Card>
    );
  }

  if (!settings) {
    return (
      <Card className="p-4">
        <div className="flex items-center text-gray-500">
          <XCircle className="w-4 h-4 mr-2" />
          <span className="text-sm">Unable to load service limits</span>
        </div>
      </Card>
    );
  }

  const getUsageColor = (used: number, limit: number) => {
    if (limit === 0) return 'text-gray-500';
    const percentage = (used / limit) * 100;
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 80) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getProgressBarColor = (used: number, limit: number) => {
    if (limit === 0) return 'bg-gray-300';
    const percentage = (used / limit) * 100;
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 80) return 'bg-yellow-500';
    return 'bg-[#01b9d4]';
  };

  const formatPercentage = (used: number, limit: number) => {
    if (limit === 0) return '0%';
    return `${Math.round((used / limit) * 100)}%`;
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Service Limits</h3>
        <Activity className="w-5 h-5 text-[#01b9d4]" />
      </div>

      <div className="space-y-4">
        {/* SMS Limits */}
        <div className="border-b pb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <MessageSquare className="w-4 h-4 mr-2 text-[#01b9d4]" />
              <span className="text-sm font-medium text-gray-700">SMS</span>
              {!settings.canUseSMS && (
                <Badge variant="secondary" className="ml-2 text-xs">Disabled</Badge>
              )}
            </div>
            {settings.canUseSMS && (
              <span className={`text-sm font-medium ${getUsageColor(settings.smsUsed, settings.smsLimit)}`}>
                {settings.smsUsed} / {settings.smsLimit}
              </span>
            )}
          </div>
          
          {settings.canUseSMS && settings.smsLimit > 0 ? (
            <>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(settings.smsUsed, settings.smsLimit)}`}
                  style={{ width: `${Math.min((settings.smsUsed / settings.smsLimit) * 100, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>{formatPercentage(settings.smsUsed, settings.smsLimit)} used</span>
                <span>{settings.smsRemaining} remaining</span>
              </div>
            </>
          ) : (
            <div className="text-xs text-gray-500">
              {settings.canUseSMS ? 'No limit set' : 'SMS service not enabled'}
            </div>
          )}
        </div>

        {/* Email Limits */}
        <div className="border-b pb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <Mail className="w-4 h-4 mr-2 text-[#01b9d4]" />
              <span className="text-sm font-medium text-gray-700">Email</span>
              {!settings.canUseEmail && (
                <Badge variant="secondary" className="ml-2 text-xs">Disabled</Badge>
              )}
            </div>
            {settings.canUseEmail && (
              <span className={`text-sm font-medium ${getUsageColor(settings.emailUsed, settings.emailLimit)}`}>
                {settings.emailUsed} / {settings.emailLimit}
              </span>
            )}
          </div>
          
          {settings.canUseEmail && settings.emailLimit > 0 ? (
            <>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(settings.emailUsed, settings.emailLimit)}`}
                  style={{ width: `${Math.min((settings.emailUsed / settings.emailLimit) * 100, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>{formatPercentage(settings.emailUsed, settings.emailLimit)} used</span>
                <span>{settings.emailRemaining} remaining</span>
              </div>
            </>
          ) : (
            <div className="text-xs text-gray-500">
              {settings.canUseEmail ? 'No limit set' : 'Email service not enabled'}
            </div>
          )}
        </div>

        {/* Feature Access */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Enabled Features</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center">
              <Stethoscope className="w-3 h-3 mr-2" />
              <span className="text-xs text-gray-600">Vitals</span>
              {settings.canRecordVitals ? (
                <CheckCircle className="w-3 h-3 ml-1 text-green-500" />
              ) : (
                <XCircle className="w-3 h-3 ml-1 text-gray-400" />
              )}
            </div>
            
            <div className="flex items-center">
              <FlaskConical className="w-3 h-3 mr-2" />
              <span className="text-xs text-gray-600">Lab</span>
              {settings.canTrackLab ? (
                <CheckCircle className="w-3 h-3 ml-1 text-green-500" />
              ) : (
                <XCircle className="w-3 h-3 ml-1 text-gray-400" />
              )}
            </div>
            
            <div className="flex items-center">
              <Camera className="w-3 h-3 mr-2" />
              <span className="text-xs text-gray-600">Media</span>
              {settings.canTrackMedia ? (
                <CheckCircle className="w-3 h-3 ml-1 text-green-500" />
              ) : (
                <XCircle className="w-3 h-3 ml-1 text-gray-400" />
              )}
            </div>
            
            <div className="flex items-center">
              <Users className="w-3 h-3 mr-2" />
              <span className="text-xs text-gray-600">Max Users</span>
              <span className="text-xs text-gray-900 ml-1">{settings.maxUsers || 'Unlimited'}</span>
            </div>
          </div>
        </div>

        {/* Warning for approaching limits */}
        {((settings.smsLimit > 0 && settings.smsUsed / settings.smsLimit > 0.8) ||
          (settings.emailLimit > 0 && settings.emailUsed / settings.emailLimit > 0.8)) && (
          <div className="flex items-center p-2 bg-yellow-50 border border-yellow-200 rounded-md">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2" />
            <span className="text-xs text-yellow-800">
              You're approaching your usage limits. Consider upgrading your plan.
            </span>
          </div>
        )}

        {/* Error state for exceeded limits */}
        {((settings.smsLimit > 0 && settings.smsUsed >= settings.smsLimit) ||
          (settings.emailLimit > 0 && settings.emailUsed >= settings.emailLimit)) && (
          <div className="flex items-center p-2 bg-red-50 border border-red-200 rounded-md">
            <XCircle className="w-4 h-4 text-red-600 mr-2" />
            <span className="text-xs text-red-800">
              You've reached your usage limits. Some features may be disabled.
            </span>
          </div>
        )}
      </div>
    </Card>
  );
};