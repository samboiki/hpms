import { supabase } from '../lib/supabase';
import { communicationService } from './communicationService';

interface ReviewRequestData {
  practiceId: string;
  patientId: string;
  visitId: string;
  patientName: string;
  patientPhone?: string;
  patientEmail?: string;
  practiceDetails: {
    name: string;
    googleReviewUrl: string;
    googlePlaceId?: string;
  };
}

export class GoogleReviewService {
  /**
   * Generate a Google review URL for the practice
   * You'll need to get your Place ID from Google Business Profile
   */
  static generateReviewUrl(placeId: string): string {
    return `https://g.page/r/${placeId}/review`;
  }

  /**
   * Generate a direct Google Maps review URL
   */
  static generateMapsReviewUrl(placeName: string): string {
    const encodedName = encodeURIComponent(placeName);
    return `https://www.google.com/maps/search/?api=1&query=${encodedName}&query_place_id=`;
  }

  /**
   * Send review request via SMS
   */
  static async sendReviewRequestSMS(data: ReviewRequestData): Promise<boolean> {
    if (!data.patientPhone || !data.practiceDetails.googleReviewUrl) {
      console.error('Missing phone number or review URL');
      return false;
    }

    const message = `Hi ${data.patientName}, thank you for visiting ${data.practiceDetails.name}! We'd love to hear about your experience. Please leave us a review: ${data.practiceDetails.googleReviewUrl}`;

    try {
      await communicationService.sendSMS({
        practiceId: data.practiceId,
        recipientPhone: data.patientPhone,
        messageContent: message,
        messageType: 'follow_up',
        patientId: data.patientId,
        visitId: data.visitId
      });

      // Log the review request
      await this.logReviewRequest(data, 'sms', 'sent');
      return true;
    } catch (error) {
      console.error('Failed to send review request SMS:', error);
      await this.logReviewRequest(data, 'sms', 'failed');
      return false;
    }
  }

  /**
   * Send review request via Email
   */
  static async sendReviewRequestEmail(data: ReviewRequestData): Promise<boolean> {
    if (!data.patientEmail || !data.practiceDetails.googleReviewUrl) {
      console.error('Missing email or review URL');
      return false;
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e3a8a;">Thank You for Visiting ${data.practiceDetails.name}!</h2>
        <p>Dear ${data.patientName},</p>
        <p>We hope you had a great experience at our practice. Your feedback helps us improve our services and helps other patients find quality dental care.</p>
        <p>Would you mind taking a moment to share your experience?</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${data.practiceDetails.googleReviewUrl}" 
             style="background-color: #1e3a8a; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Leave a Google Review
          </a>
        </div>
        <p>Thank you for choosing ${data.practiceDetails.name}!</p>
      </div>
    `;

    try {
      await communicationService.sendEmail({
        practiceId: data.practiceId,
        recipientEmail: data.patientEmail,
        subject: `How was your visit to ${data.practiceDetails.name}?`,
        htmlContent,
        emailType: 'review_request',
        patientId: data.patientId,
        visitId: data.visitId
      });

      // Log the review request
      await this.logReviewRequest(data, 'email', 'sent');
      return true;
    } catch (error) {
      console.error('Failed to send review request email:', error);
      await this.logReviewRequest(data, 'email', 'failed');
      return false;
    }
  }

  /**
   * Log review request for tracking
   */
  private static async logReviewRequest(
    data: ReviewRequestData, 
    method: 'sms' | 'email', 
    status: 'sent' | 'failed'
  ): Promise<void> {
    // TODO: Implement review_requests table first
    console.log('Would log review request:', {
      practice_id: data.practiceId,
      patient_id: data.patientId,
      visit_id: data.visitId,
      method,
      status,
      sent_at: new Date().toISOString()
    });
  }

  /**
   * Check if a review request was already sent for this visit
   */
  static async wasReviewRequested(visitId: string): Promise<boolean> {
    // TODO: Implement review_requests table first
    console.log('Checking if review was requested for visit:', visitId);
    return false;
  }

  /**
   * Get review statistics for a practice
   */
  static async getReviewStats(practiceId: string): Promise<{
    totalRequests: number;
    sentRequests: number;
    failedRequests: number;
    conversionRate: number;
  }> {
    // TODO: Implement review_requests table first
    console.log('Review stats requested for practice:', practiceId);
    return {
      totalRequests: 0,
      sentRequests: 0,
      failedRequests: 0,
      conversionRate: 0
    };
  }
}

export default GoogleReviewService;