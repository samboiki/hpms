import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface DocumentStatusListener {
  visitId: string;
  callback: (status: DocumentStatus) => void;
}

interface DocumentStatus {
  visitId: string;
  hasDocuments: boolean;
  documentTypes: string[];
}

class DocumentStatusService {
  private channel: RealtimeChannel | null = null;
  private listeners: Map<string, DocumentStatusListener[]> = new Map();

  /**
   * Subscribe to document status updates for a specific visit
   */
  subscribeToVisit(visitId: string, callback: (status: DocumentStatus) => void) {
    if (!this.channel) {
      this.initializeChannel();
    }

    // Add listener
    const listener: DocumentStatusListener = { visitId, callback };
    const existingListeners = this.listeners.get(visitId) || [];
    this.listeners.set(visitId, [...existingListeners, listener]);

    // Check current status immediately
    this.checkDocumentStatus(visitId).then(status => {
      callback(status);
    });

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(visitId) || [];
      this.listeners.set(
        visitId,
        listeners.filter(l => l !== listener)
      );
    };
  }

  /**
   * Initialize real-time channel for document updates
   */
  private initializeChannel() {
    this.channel = supabase
      .channel('document-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'generated_documents'
        },
        (payload) => {
          const visitId = payload.new?.visit_id || payload.old?.visit_id;
          if (visitId) {
            this.notifyListeners(visitId);
          }
        }
      )
      .subscribe();
  }

  /**
   * Notify all listeners for a specific visit
   */
  private async notifyListeners(visitId: string) {
    const listeners = this.listeners.get(visitId) || [];
    if (listeners.length === 0) return;

    const status = await this.checkDocumentStatus(visitId);
    listeners.forEach(listener => {
      listener.callback(status);
    });
  }

  /**
   * Check current document status for a visit
   */
  private async checkDocumentStatus(visitId: string): Promise<DocumentStatus> {
    try {
      const { data: documents } = await supabase
        .from('generated_documents')
        .select('document_type')
        .eq('visit_id', visitId);

      const documentTypes = documents?.map(d => d.document_type) || [];
      
      return {
        visitId,
        hasDocuments: documentTypes.length > 0,
        documentTypes
      };
    } catch (error) {
      console.error('Error checking document status:', error);
      return {
        visitId,
        hasDocuments: false,
        documentTypes: []
      };
    }
  }

  /**
   * Cleanup subscriptions
   */
  cleanup() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.listeners.clear();
  }
}

// Export singleton instance
export const documentStatusService = new DocumentStatusService();