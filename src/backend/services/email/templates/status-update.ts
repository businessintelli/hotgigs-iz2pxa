import handlebars from 'handlebars'; // ^4.7.8
import i18next from 'i18next'; // ^23.5.0
import { ApplicationStatus } from '../../../../types/candidates';
import { handleError } from '../../../../utils/error-handler';

/**
 * Interface for template configuration options
 */
interface TemplateConfig {
  defaultLocale?: string;
  fallbackLocale?: string;
  cacheDuration?: number;
  securityOptions?: {
    escapeHtml?: boolean;
    allowedTags?: string[];
    maxLength?: number;
  };
}

/**
 * Interface for template data
 */
interface StatusTemplateData {
  candidateName: string;
  jobTitle: string;
  companyName: string;
  applicationStatus: ApplicationStatus;
  nextSteps?: string;
  contactEmail?: string;
  interviewDetails?: {
    date?: string;
    time?: string;
    location?: string;
    interviewerName?: string;
  };
}

/**
 * Enhanced class for generating secure and localized status update email templates
 */
export class StatusUpdateEmailTemplate {
  private templateCache: Map<string, HandlebarsTemplateDelegate>;
  private i18n: typeof i18next;
  private securityConfig: Required<TemplateConfig['securityOptions']>;
  
  constructor(config: TemplateConfig = {}) {
    this.templateCache = new Map();
    
    // Initialize i18next with default configuration
    this.i18n = i18next.createInstance();
    this.i18n.init({
      lng: config.defaultLocale || 'en',
      fallbackLng: config.fallbackLocale || 'en',
      interpolation: { escapeValue: true },
      resources: {
        en: {
          translation: require('./locales/en.json'),
        },
      },
    });

    // Set security configuration with defaults
    this.securityConfig = {
      escapeHtml: true,
      allowedTags: ['b', 'i', 'em', 'strong', 'a', 'br'],
      maxLength: 10000,
      ...config.securityOptions,
    };

    // Register custom handlebars helpers
    handlebars.registerHelper('formatDate', (date: string) => {
      return new Date(date).toLocaleDateString();
    });

    handlebars.registerHelper('sanitize', (text: string) => {
      if (!text) return '';
      return this.sanitizeContent(text);
    });
  }

  /**
   * Compiles email templates with caching and error handling
   */
  public async compileTemplate(
    templateData: StatusTemplateData,
    locale: string = 'en'
  ): Promise<{ html: string; text: string }> {
    try {
      // Validate input data
      this.validateTemplateData(templateData);

      // Generate cache key
      const cacheKey = `${templateData.applicationStatus}_${locale}`;

      // Check cache first
      let htmlTemplate = this.templateCache.get(cacheKey);
      
      if (!htmlTemplate) {
        const statusContent = await this.getStatusSpecificContent(
          templateData.applicationStatus,
          locale
        );

        // Compile and cache template
        htmlTemplate = handlebars.compile(statusContent.html, {
          noEscape: !this.securityConfig.escapeHtml,
        });
        this.templateCache.set(cacheKey, htmlTemplate);
      }

      // Sanitize template data
      const sanitizedData = this.sanitizeTemplateData(templateData);

      // Compile HTML version
      const html = htmlTemplate(sanitizedData);

      // Generate plain text version
      const text = this.generatePlainText(html);

      return { html, text };
    } catch (error) {
      throw handleError(error, { templateData, locale });
    }
  }

  /**
   * Retrieves status-specific content with fallback support
   */
  private async getStatusSpecificContent(
    status: ApplicationStatus,
    locale: string
  ): Promise<{ html: string; text: string }> {
    const templates = {
      [ApplicationStatus.APPLIED]: {
        html: this.i18n.t('templates.applied.html', { lng: locale }),
        text: this.i18n.t('templates.applied.text', { lng: locale }),
      },
      [ApplicationStatus.SCREENING]: {
        html: this.i18n.t('templates.screening.html', { lng: locale }),
        text: this.i18n.t('templates.screening.text', { lng: locale }),
      },
      [ApplicationStatus.INTERVIEWING]: {
        html: this.i18n.t('templates.interviewing.html', { lng: locale }),
        text: this.i18n.t('templates.interviewing.text', { lng: locale }),
      },
      [ApplicationStatus.OFFER_PENDING]: {
        html: this.i18n.t('templates.offer_pending.html', { lng: locale }),
        text: this.i18n.t('templates.offer_pending.text', { lng: locale }),
      },
      [ApplicationStatus.OFFER_ACCEPTED]: {
        html: this.i18n.t('templates.offer_accepted.html', { lng: locale }),
        text: this.i18n.t('templates.offer_accepted.text', { lng: locale }),
      },
      [ApplicationStatus.OFFER_DECLINED]: {
        html: this.i18n.t('templates.offer_declined.html', { lng: locale }),
        text: this.i18n.t('templates.offer_declined.text', { lng: locale }),
      },
      [ApplicationStatus.REJECTED]: {
        html: this.i18n.t('templates.rejected.html', { lng: locale }),
        text: this.i18n.t('templates.rejected.text', { lng: locale }),
      },
    };

    return templates[status] || templates[ApplicationStatus.APPLIED];
  }

  /**
   * Validates template data structure and content
   */
  private validateTemplateData(data: StatusTemplateData): void {
    if (!data.candidateName || !data.jobTitle || !data.companyName) {
      throw new Error('Missing required template data fields');
    }

    if (!Object.values(ApplicationStatus).includes(data.applicationStatus)) {
      throw new Error('Invalid application status');
    }

    if (data.nextSteps && data.nextSteps.length > this.securityConfig.maxLength) {
      throw new Error('Next steps content exceeds maximum length');
    }
  }

  /**
   * Sanitizes template data to prevent XSS and injection attacks
   */
  private sanitizeTemplateData(data: StatusTemplateData): StatusTemplateData {
    return {
      ...data,
      candidateName: this.sanitizeContent(data.candidateName),
      jobTitle: this.sanitizeContent(data.jobTitle),
      companyName: this.sanitizeContent(data.companyName),
      nextSteps: data.nextSteps ? this.sanitizeContent(data.nextSteps) : undefined,
      interviewDetails: data.interviewDetails ? {
        ...data.interviewDetails,
        location: data.interviewDetails.location ? 
          this.sanitizeContent(data.interviewDetails.location) : undefined,
        interviewerName: data.interviewDetails.interviewerName ?
          this.sanitizeContent(data.interviewDetails.interviewerName) : undefined,
      } : undefined,
    };
  }

  /**
   * Sanitizes content according to security configuration
   */
  private sanitizeContent(content: string): string {
    if (!content) return '';
    
    let sanitized = content;
    
    if (this.securityConfig.escapeHtml) {
      sanitized = handlebars.escapeExpression(sanitized);
    }

    if (sanitized.length > this.securityConfig.maxLength) {
      sanitized = sanitized.substring(0, this.securityConfig.maxLength);
    }

    return sanitized;
  }

  /**
   * Generates plain text version from HTML content
   */
  private generatePlainText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
  }
}

/**
 * Factory function to create a configured StatusUpdateEmailTemplate instance
 */
export function createStatusUpdateTemplate(
  config: TemplateConfig = {}
): StatusUpdateEmailTemplate {
  return new StatusUpdateEmailTemplate(config);
}