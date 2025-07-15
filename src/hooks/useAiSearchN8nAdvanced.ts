import { useState, useCallback, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Patient } from '../stores/patientsStoreNew';
import { usePractice } from '../contexts/PracticeContext';

export interface AiSearchProgress {
  status: 'started' | 'fetching_schema' | 'generating_sql' | 'verifying_security' | 'executing_query' | 'completed' | 'error';
  message: string;
  progress: number;
}

export interface AiSearchResult {
  success: boolean;
  patientIds?: string[];
  count?: number;
  description?: string;
  detailedAnalysis?: string;
  searchQuery?: string;
  confidence?: number;
  securityScore?: number;
  performanceScore?: number;
  suggestions?: string[];
  error?: string;
  errorType?: string;
  issues?: string[];
  executionTime?: number;
  timestamp: string;
  requestId?: string;
}

export function useAiSearchN8nAdvanced(
  patients: Patient[],
  setCurrentPage: (page: number) => void
) {
  const { practiceId } = usePractice();
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [searchDescription, setSearchDescription] = useState<string>('');
  const [detailedAnalysis, setDetailedAnalysis] = useState<string>('');
  const [aiFilteredPatients, setAiFilteredPatients] = useState<Patient[] | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState<string>('');
  const [searchProgress, setSearchProgress] = useState<AiSearchProgress | null>(null);
  const [searchMetrics, setSearchMetrics] = useState<{
    confidence?: number;
    securityScore?: number;
    performanceScore?: number;
    executionTime?: number;
  }>({});

  // WebSocket connection for progress updates
  useEffect(() => {
    if (!isAiSearching) return;

    const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://onehealthsystems.app.n8n.cloud/webhook/onehealth-search';
    const wsUrl = webhookUrl.replace('http://', 'ws://').replace('https://', 'wss://').replace('/webhook/onehealth-search', '/ws/onehealth-search');
    
    let ws: WebSocket | null = null;
    
    try {
      ws = new WebSocket(wsUrl);
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'progress') {
            setSearchProgress(data.data);
            
            // Show progress toast
            if (data.data.status === 'error') {
              toast.error(data.data.message);
            } else if (data.data.progress < 100) {
              toast.loading(data.data.message, { id: 'ai-search-progress' });
            }
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };
      
      ws.onerror = (error) => {
        console.warn('WebSocket error:', error);
        // Fallback to polling or static progress
      };
      
      return () => {
        if (ws) {
          ws.close();
        }
      };
    } catch (error) {
      console.warn('WebSocket not supported or failed to connect');
    }
  }, [isAiSearching]);

  const searchPatients = useCallback(async (query: string) => {
    if (!query.trim() || isAiSearching) return;
    
    console.log('🔍 Advanced AI Search initiated with query:', query);
    setIsAiSearching(true);
    setLastSearchQuery(query);
    setSearchProgress({ status: 'started', message: 'Initializing AI search...', progress: 0 });
    
    // Clear previous results
    setDetailedAnalysis('');
    setSearchMetrics({});
    
    try {
      const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://onehealthsystems.app.n8n.cloud/webhook/onehealth-search';
      const apiKey = import.meta.env.VITE_N8N_API_KEY || '';
      const sessionId = crypto.randomUUID();
      
      console.log('📡 Calling n8n webhook with session:', sessionId);
      
      const startTime = Date.now();
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { 'X-API-Key': apiKey })
        },
        body: JSON.stringify({
          query,
          practiceId,
          sessionId
        })
      }).catch(fetchError => {
        console.error('Fetch error details:', fetchError);
        throw new Error(`Network error: ${fetchError.message}`);
      });
      
      const executionTime = Date.now() - startTime;
      console.log('📨 Response received in', executionTime, 'ms');
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ n8n webhook error:', response.status, errorText);
        throw new Error(`n8n webhook returned ${response.status}: ${errorText}`);
      }
      
      // Check if response has content
      const responseText = await response.text();
      console.log('📄 Raw response:', responseText);
      
      if (!responseText) {
        throw new Error('Empty response from n8n webhook');
      }
      
      let data: AiSearchResult;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Failed to parse response:', parseError);
        throw new Error('Invalid JSON response from n8n webhook');
      }
      console.log('✅ AI Search response:', data);
      
      if (data.success && data.patientIds) {
        // Filter patients by returned IDs
        const filteredPatients = patients.filter(p => 
          data.patientIds!.includes(p.id)
        );
        
        console.log(`✅ Found ${filteredPatients.length} patients matching criteria`);
        
        // Update state with all the rich data
        setAiFilteredPatients(filteredPatients);
        setSearchDescription(data.description || query);
        setDetailedAnalysis(data.detailedAnalysis || '');
        setSearchMetrics({
          confidence: data.confidence,
          securityScore: data.securityScore,
          performanceScore: data.performanceScore,
          executionTime: data.executionTime || executionTime
        });
        setCurrentPage(1);
        
        // Dismiss loading toast and show success
        toast.dismiss('ai-search-progress');
        
        if (filteredPatients.length === 0) {
          toast.error('No patients found matching your criteria.');
          
          // Show suggestions if available
          if (data.suggestions && data.suggestions.length > 0) {
            setTimeout(() => {
              const message = `Try these searches:\n${data.suggestions.join('\n• ')}`;
              toast.error(message, { duration: 5000 });
            }, 500);
          }
        } else {
          toast.success(`Found ${filteredPatients.length} patients: ${data.description}`);
        }
        
        // Show performance warning if needed
        if (data.performanceScore && data.performanceScore < 0.5) {
          toast.warning('This search might be slow with larger datasets', { duration: 4000 });
        }
        
      } else {
        throw new Error(data.error || 'Search failed');
      }
      
    } catch (error: any) {
      console.error('❌ AI search error:', error);
      console.error('Error type:', error.name);
      console.error('Error stack:', error.stack);
      
      toast.dismiss('ai-search-progress');
      
      let errorMessage = 'AI search failed. ';
      
      // More specific error handling
      if (error?.message?.includes('Network error')) {
        errorMessage += 'Network error - check if n8n webhook is accessible and CORS is configured.';
      } else if (error?.message?.includes('fetch')) {
        errorMessage += 'Could not connect to AI service. Make sure n8n workflow includes a "Respond to Webhook" node.';
      } else if (error?.message?.includes('CORS')) {
        errorMessage += 'CORS error - n8n webhook needs to allow requests from ' + window.location.origin;
      } else if (error?.message?.includes('Empty response')) {
        errorMessage += 'n8n webhook returned empty response. Add a "Respond to Webhook" node to your workflow.';
      } else if (error?.message?.includes('Invalid JSON')) {
        errorMessage += 'n8n webhook returned invalid JSON. Check the response format.';
      } else {
        errorMessage += error?.message || 'Please try again.';
      }
      
      toast.error(errorMessage, { duration: 6000 });
      
      // Clear any previous results on error
      setAiFilteredPatients(null);
      setSearchDescription('');
      setDetailedAnalysis('');
      setSearchMetrics({});
    } finally {
      setIsAiSearching(false);
      setSearchProgress(null);
    }
  }, [isAiSearching, patients, practiceId, setCurrentPage]);

  const clearAiSearch = useCallback(() => {
    setAiFilteredPatients(null);
    setSearchDescription('');
    setDetailedAnalysis('');
    setLastSearchQuery('');
    setSearchProgress(null);
    setSearchMetrics({});
  }, []);

  return {
    isAiSearching,
    searchDescription,
    detailedAnalysis,
    aiFilteredPatients,
    lastSearchQuery,
    searchProgress,
    searchMetrics,
    searchPatients,
    clearAiSearch
  };
};