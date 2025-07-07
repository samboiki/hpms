import React, { useState } from 'react';
import { 
  BrainCircuit, 
  Sparkles,
  MessageSquare,
  Mail,
  Wand2,
  RefreshCw,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Send,
  Lightbulb,
  Target,
  Clock,
  Users,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Suggestion {
  id: string;
  type: 'greeting' | 'reminder' | 'follow-up' | 'promotional' | 'educational';
  title: string;
  content: string;
  tone: 'formal' | 'friendly' | 'casual';
  scenario: string;
}

interface ABTestResult {
  versionA: string;
  versionB: string;
  recommendation: 'A' | 'B';
  reasoning: string;
  metrics: {
    expectedOpenRate: { A: number; B: number };
    expectedCTR: { A: number; B: number };
  };
}

const AIAssistant: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState<'suggestions' | 'optimize' | 'ab-test' | 'insights'>('suggestions');
  const [messageType, setMessageType] = useState<'sms' | 'email'>('email');
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [optimizedText, setOptimizedText] = useState('');
  const [abTestResult, setABTestResult] = useState<ABTestResult | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedTone, setSelectedTone] = useState<'formal' | 'friendly' | 'casual'>('friendly');

  const generateSuggestions = async () => {
    setIsGenerating(true);
    
    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const mockSuggestions: Suggestion[] = [
      {
        id: '1',
        type: 'reminder',
        title: 'Appointment Reminder - Friendly',
        content: `Hi {patientName}! Just a friendly reminder about your appointment tomorrow at {appointmentTime} with Dr. {doctorName}. We're looking forward to seeing you! Please arrive 10 minutes early. Reply CONFIRM to confirm or CANCEL to cancel.`,
        tone: 'friendly',
        scenario: 'Use for regular appointment reminders'
      },
      {
        id: '2',
        type: 'reminder',
        title: 'Appointment Reminder - Formal',
        content: `Dear {patientName}, This is a reminder of your scheduled appointment on {appointmentDate} at {appointmentTime} with Dr. {doctorName}. Please arrive 10 minutes prior to your appointment time. To confirm, reply YES. To cancel, reply NO.`,
        tone: 'formal',
        scenario: 'Use for first-time patients or formal communications'
      },
      {
        id: '3',
        type: 'follow-up',
        title: 'Post-Visit Follow-up',
        content: `Hi {patientName}, I hope you're feeling better after your visit yesterday. Remember to take your medication as prescribed. If you have any questions or concerns, don't hesitate to reach out. Your health is our priority!`,
        tone: 'friendly',
        scenario: 'Send 24 hours after appointment'
      }
    ];
    
    setSuggestions(mockSuggestions);
    setIsGenerating(false);
  };

  const optimizeMessage = async () => {
    if (!inputText.trim()) return;
    
    setIsGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock optimization
    const optimized = inputText
      .replace(/\b(appointment|meeting)\b/gi, '**appointment**')
      .replace(/\b(important|urgent)\b/gi, '⚠️ $1')
      + '\n\n📅 Save time by confirming online: [Link]';
    
    setOptimizedText(optimized);
    setIsGenerating(false);
  };

  const runABTest = async () => {
    if (!inputText.trim()) return;
    
    setIsGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const result: ABTestResult = {
      versionA: inputText,
      versionB: `🏥 ${inputText}\n\n✅ Quick actions: Reply YES to confirm or NO to cancel.`,
      recommendation: 'B',
      reasoning: 'Version B includes emojis and clear call-to-action, which typically increases engagement by 23% in healthcare communications.',
      metrics: {
        expectedOpenRate: { A: 68, B: 82 },
        expectedCTR: { A: 12, B: 18 }
      }
    };
    
    setABTestResult(result);
    setIsGenerating(false);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const insights = [
    {
      icon: Clock,
      title: 'Best Send Times',
      description: 'Tuesday-Thursday, 10-11 AM and 2-3 PM show highest engagement',
      metric: '+34% open rate'
    },
    {
      icon: Users,
      title: 'Personalization Impact',
      description: 'Messages with patient names see 2.5x higher response rates',
      metric: '+150% responses'
    },
    {
      icon: MessageSquare,
      title: 'SMS vs Email',
      description: 'SMS has 98% open rate vs 22% for email in your practice',
      metric: '98% vs 22%'
    },
    {
      icon: TrendingUp,
      title: 'Emoji Usage',
      description: 'Strategic emoji use increases engagement by 25%',
      metric: '+25% CTR'
    }
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[30px] font-bold font-heading text-[#494c61]">AI Communication Assistant</h1>
          <p className="text-gray-600 mt-1">Enhance your messages with AI-powered suggestions</p>
        </div>
        <BrainCircuit className="w-8 h-8 text-primary-500" />
      </div>

      {/* Feature Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { id: 'suggestions', label: 'Message Suggestions', icon: Sparkles },
          { id: 'optimize', label: 'Optimize Message', icon: Wand2 },
          { id: 'ab-test', label: 'A/B Testing', icon: Target },
          { id: 'insights', label: 'Insights', icon: Lightbulb }
        ].map((feature) => (
          <motion.button
            key={feature.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveFeature(feature.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeFeature === feature.id
                ? 'bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <feature.icon className="w-4 h-4" />
            {feature.label}
          </motion.button>
        ))}
      </div>

      {/* Message Suggestions */}
      {activeFeature === 'suggestions' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate Message Templates</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message Type</label>
                <div className="flex gap-2">
                  {(['sms', 'email'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setMessageType(type)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        messageType === type
                          ? 'bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {type === 'sms' ? <MessageSquare className="w-4 h-4 inline mr-2" /> : <Mail className="w-4 h-4 inline mr-2" />}
                      {type.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
                <div className="flex gap-2">
                  {(['formal', 'friendly', 'casual'] as const).map((tone) => (
                    <button
                      key={tone}
                      onClick={() => setSelectedTone(tone)}
                      className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
                        selectedTone === tone
                          ? 'bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={generateSuggestions}
              disabled={isGenerating}
              className="w-full bg-primary-500 text-white px-4 py-3 rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating suggestions...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate AI Suggestions
                </>
              )}
            </motion.button>
          </div>

          {/* Suggestions List */}
          <AnimatePresence>
            {suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                {suggestions.map((suggestion, index) => (
                  <motion.div
                    key={suggestion.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">{suggestion.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">{suggestion.scenario}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        suggestion.tone === 'formal' ? 'bg-gray-100 text-gray-700' :
                        suggestion.tone === 'friendly' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {suggestion.tone}
                      </span>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{suggestion.content}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => copyToClipboard(suggestion.content, suggestion.id)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors text-sm"
                      >
                        {copiedId === suggestion.id ? (
                          <>
                            <Check className="w-3 h-3" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copy
                          </>
                        )}
                      </motion.button>
                      
                      <button className="p-1.5 text-gray-600 hover:text-green-600 transition-colors">
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                      
                      <button className="p-1.5 text-gray-600 hover:text-red-600 transition-colors">
                        <ThumbsDown className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Optimize Message */}
      {activeFeature === 'optimize' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Optimize Your Message</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Original Message
                </label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste your message here for AI optimization..."
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={optimizeMessage}
                disabled={isGenerating || !inputText.trim()}
                className="w-full bg-primary-500 text-white px-4 py-3 rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Optimizing...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Optimize Message
                  </>
                )}
              </motion.button>
            </div>
          </div>

          {optimizedText && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <h4 className="font-semibold text-gray-900 mb-3">Optimized Version</h4>
              <div className="bg-green-50 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{optimizedText}</p>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  +15% expected engagement
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Optimized for readability
                </span>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* A/B Testing */}
      {activeFeature === 'ab-test' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">A/B Test Your Message</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Message
                </label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Enter your message to generate A/B test variations..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={runABTest}
                disabled={isGenerating || !inputText.trim()}
                className="w-full bg-primary-500 text-white px-4 py-3 rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generating variations...
                  </>
                ) : (
                  <>
                    <Target className="w-4 h-4" />
                    Generate A/B Test
                  </>
                )}
              </motion.button>
            </div>
          </div>

          {abTestResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900">Version A</h4>
                    {abTestResult.recommendation === 'A' && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 mb-3">
                    <p className="text-sm text-gray-700">{abTestResult.versionA}</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-600">
                      Expected open rate: <span className="font-medium">{abTestResult.metrics.expectedOpenRate.A}%</span>
                    </p>
                    <p className="text-gray-600">
                      Expected CTR: <span className="font-medium">{abTestResult.metrics.expectedCTR.A}%</span>
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900">Version B</h4>
                    {abTestResult.recommendation === 'B' && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 mb-3">
                    <p className="text-sm text-gray-700">{abTestResult.versionB}</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-600">
                      Expected open rate: <span className="font-medium">{abTestResult.metrics.expectedOpenRate.B}%</span>
                    </p>
                    <p className="text-gray-600">
                      Expected CTR: <span className="font-medium">{abTestResult.metrics.expectedCTR.B}%</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h5 className="font-medium text-blue-900 mb-2">AI Recommendation</h5>
                <p className="text-sm text-blue-800">{abTestResult.reasoning}</p>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Insights */}
      {activeFeature === 'insights' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {insights.map((insight, index) => {
            const Icon = insight.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary-100 rounded-lg">
                    <Icon className="w-6 h-6 text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">{insight.title}</h4>
                    <p className="text-sm text-gray-600 mb-2">{insight.description}</p>
                    <p className="text-lg font-bold text-primary-600">{insight.metric}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: insights.length * 0.1 }}
            className="md:col-span-2 bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg shadow-sm p-6 text-white"
          >
            <div className="flex items-center gap-4">
              <Lightbulb className="w-8 h-8" />
              <div>
                <h4 className="text-lg font-semibold mb-1">Pro Tip</h4>
                <p className="text-primary-100">
                  Combine personalization with optimal timing for maximum impact. Messages sent on Tuesday mornings 
                  with the patient's name have the highest engagement rates in healthcare communications.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AIAssistant;