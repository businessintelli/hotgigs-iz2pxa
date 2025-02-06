import { jest } from 'jest'; // ^29.0.0
import { OpenAIService } from '../../services/ai/openai';
import { EmailSender } from '../../services/email/sender';
import { GoogleCalendarService } from '../../services/calendar/google-calendar';
import { ErrorCode } from '../../types/common';

/**
 * Enhanced mock implementation of OpenAI service for testing
 */
export class MockOpenAIService implements Pick<OpenAIService, 'generateEmbeddings' | 'generateCompletion' | 'analyzeText'> {
  private generateEmbeddingsMock: jest.Mock;
  private generateCompletionMock: jest.Mock;
  private analyzeTextMock: jest.Mock;
  private callHistory: Map<string, any[]>;
  private mockResponses: Record<string, any>;

  constructor() {
    this.generateEmbeddingsMock = jest.fn();
    this.generateCompletionMock = jest.fn();
    this.analyzeTextMock = jest.fn();
    this.callHistory = new Map();
    this.mockResponses = this.getDefaultResponses();
  }

  async generateEmbeddings(text: string, options = {}): Promise<number[]> {
    this.trackMethodCall('generateEmbeddings', { text, options });
    return this.generateEmbeddingsMock(text, options);
  }

  async generateCompletion(prompt: string, options = {}): Promise<string> {
    this.trackMethodCall('generateCompletion', { prompt, options });
    return this.generateCompletionMock(prompt, options);
  }

  async analyzeText(text: string, options: any): Promise<any> {
    this.trackMethodCall('analyzeText', { text, options });
    return this.analyzeTextMock(text, options);
  }

  // Configure mock responses
  setMockResponse(method: string, response: any, error?: boolean): void {
    if (error) {
      const mockFn = this[`${method}Mock`] as jest.Mock;
      mockFn.mockRejectedValue(new Error(`Mock ${method} error`));
    } else {
      const mockFn = this[`${method}Mock`] as jest.Mock;
      mockFn.mockResolvedValue(response);
    }
  }

  // Reset all mocks to default state
  resetMocks(): void {
    this.generateEmbeddingsMock.mockReset();
    this.generateCompletionMock.mockReset();
    this.analyzeTextMock.mockReset();
    this.callHistory.clear();
    this.setDefaultResponses();
  }

  // Get call history for verification
  getCallHistory(method: string): any[] {
    return this.callHistory.get(method) || [];
  }

  private trackMethodCall(method: string, args: any): void {
    const calls = this.callHistory.get(method) || [];
    calls.push({ timestamp: new Date(), args });
    this.callHistory.set(method, calls);
  }

  private getDefaultResponses(): Record<string, any> {
    return {
      generateEmbeddings: new Array(1536).fill(0).map(() => Math.random()),
      generateCompletion: "Mock completion response",
      analyzeText: {
        category: "skills",
        data: {
          technical: ["TypeScript", "React", "Node.js"],
          soft: ["Communication", "Leadership"]
        },
        confidence: 0.95,
        metadata: {
          model: "gpt-4",
          timestamp: new Date().toISOString()
        }
      }
    };
  }

  private setDefaultResponses(): void {
    const defaults = this.getDefaultResponses();
    Object.entries(defaults).forEach(([method, response]) => {
      this.setMockResponse(method, response);
    });
  }
}

/**
 * Enhanced mock implementation of Email service for testing
 */
export class MockEmailSender implements Pick<EmailSender, 'sendEmail' | 'sendBulkEmails'> {
  private sendEmailMock: jest.Mock;
  private sendBulkEmailsMock: jest.Mock;
  private callHistory: Map<string, any[]>;
  private errorScenarios: Set<string>;

  constructor() {
    this.sendEmailMock = jest.fn();
    this.sendBulkEmailsMock = jest.fn();
    this.callHistory = new Map();
    this.errorScenarios = new Set();
    this.setDefaultResponses();
  }

  async sendEmail(options: any): Promise<boolean> {
    this.trackMethodCall('sendEmail', options);
    
    if (this.errorScenarios.has('sendEmail')) {
      throw new Error('Mock email sending error');
    }
    
    return this.sendEmailMock(options);
  }

  async sendBulkEmails(emailOptionsList: any[]): Promise<Array<{ success: boolean; error?: Error; metadata: object }>> {
    this.trackMethodCall('sendBulkEmails', emailOptionsList);
    
    if (this.errorScenarios.has('sendBulkEmails')) {
      throw new Error('Mock bulk email sending error');
    }
    
    return this.sendBulkEmailsMock(emailOptionsList);
  }

  setErrorScenario(method: string): void {
    this.errorScenarios.add(method);
  }

  clearErrorScenarios(): void {
    this.errorScenarios.clear();
  }

  getCallHistory(method: string): any[] {
    return this.callHistory.get(method) || [];
  }

  resetMocks(): void {
    this.sendEmailMock.mockReset();
    this.sendBulkEmailsMock.mockReset();
    this.callHistory.clear();
    this.errorScenarios.clear();
    this.setDefaultResponses();
  }

  private trackMethodCall(method: string, args: any): void {
    const calls = this.callHistory.get(method) || [];
    calls.push({ timestamp: new Date(), args });
    this.callHistory.set(method, calls);
  }

  private setDefaultResponses(): void {
    this.sendEmailMock.mockResolvedValue(true);
    this.sendBulkEmailsMock.mockResolvedValue([
      { success: true, metadata: { timestamp: new Date().toISOString() } }
    ]);
  }
}

/**
 * Enhanced mock implementation of Calendar service for testing
 */
export class MockGoogleCalendarService implements Pick<GoogleCalendarService, 'createEvent' | 'updateEvent' | 'deleteEvent' | 'getAvailableSlots'> {
  private createEventMock: jest.Mock;
  private updateEventMock: jest.Mock;
  private deleteEventMock: jest.Mock;
  private getAvailableSlotsMock: jest.Mock;
  private callHistory: Map<string, any[]>;
  private errorScenarios: Set<string>;

  constructor() {
    this.createEventMock = jest.fn();
    this.updateEventMock = jest.fn();
    this.deleteEventMock = jest.fn();
    this.getAvailableSlotsMock = jest.fn();
    this.callHistory = new Map();
    this.errorScenarios = new Set();
    this.setDefaultResponses();
  }

  async createEvent(interview: any): Promise<any> {
    this.trackMethodCall('createEvent', interview);
    
    if (this.errorScenarios.has('createEvent')) {
      return {
        success: false,
        data: null,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Mock calendar event creation error',
          details: null
        }
      };
    }
    
    return this.createEventMock(interview);
  }

  async updateEvent(eventId: string, interview: any): Promise<any> {
    this.trackMethodCall('updateEvent', { eventId, interview });
    
    if (this.errorScenarios.has('updateEvent')) {
      return {
        success: false,
        data: null,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Mock calendar event update error',
          details: null
        }
      };
    }
    
    return this.updateEventMock(eventId, interview);
  }

  async deleteEvent(eventId: string, notifyAttendees: boolean = true): Promise<any> {
    this.trackMethodCall('deleteEvent', { eventId, notifyAttendees });
    
    if (this.errorScenarios.has('deleteEvent')) {
      return {
        success: false,
        data: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Mock calendar event deletion error',
          details: null
        }
      };
    }
    
    return this.deleteEventMock(eventId, notifyAttendees);
  }

  async getAvailableSlots(startDate: Date, endDate: Date, attendeeEmails: string[], timezone: string): Promise<any> {
    this.trackMethodCall('getAvailableSlots', { startDate, endDate, attendeeEmails, timezone });
    
    if (this.errorScenarios.has('getAvailableSlots')) {
      return {
        success: false,
        data: null,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Mock get available slots error',
          details: null
        }
      };
    }
    
    return this.getAvailableSlotsMock(startDate, endDate, attendeeEmails, timezone);
  }

  setErrorScenario(method: string): void {
    this.errorScenarios.add(method);
  }

  clearErrorScenarios(): void {
    this.errorScenarios.clear();
  }

  getCallHistory(method: string): any[] {
    return this.callHistory.get(method) || [];
  }

  resetMocks(): void {
    this.createEventMock.mockReset();
    this.updateEventMock.mockReset();
    this.deleteEventMock.mockReset();
    this.getAvailableSlotsMock.mockReset();
    this.callHistory.clear();
    this.errorScenarios.clear();
    this.setDefaultResponses();
  }

  private trackMethodCall(method: string, args: any): void {
    const calls = this.callHistory.get(method) || [];
    calls.push({ timestamp: new Date(), args });
    this.callHistory.set(method, calls);
  }

  private setDefaultResponses(): void {
    const mockEventResponse = {
      success: true,
      data: {
        eventId: 'mock-event-id',
        meetingLink: 'https://meet.google.com/mock-link',
        attendees: ['test@example.com'],
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000)
      },
      error: null
    };

    this.createEventMock.mockResolvedValue(mockEventResponse);
    this.updateEventMock.mockResolvedValue(mockEventResponse);
    this.deleteEventMock.mockResolvedValue({ success: true, data: true, error: null });
    this.getAvailableSlotsMock.mockResolvedValue({
      success: true,
      data: [{
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        attendees: ['test@example.com'],
        timezone: 'UTC'
      }],
      error: null
    });
  }
}