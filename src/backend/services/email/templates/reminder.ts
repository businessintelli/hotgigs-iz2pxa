import handlebars from 'handlebars'; // ^4.7.8
import dayjs from 'dayjs'; // ^1.11.10
import { Interview, InterviewType, InterviewStatus } from '../../../../types/interviews';
import { handleError } from '../../../../utils/error-handler';

/**
 * Advanced email template service for generating dynamic, localized reminder notifications
 */
export class ReminderEmailTemplate {
  private compiledTemplates: Map<string, HandlebarsTemplateDelegate>;
  private templateConfig: Record<string, any>;
  private localizations: Map<string, Record<string, string>>;

  constructor(config: Record<string, any> = {}) {
    this.compiledTemplates = new Map();
    this.templateConfig = {
      defaultLocale: 'en',
      dateFormat: 'MMMM D, YYYY [at] h:mm A',
      ...config
    };
    this.localizations = new Map();
    
    this.initializeTemplates();
    this.registerHelpers();
  }

  /**
   * Generates optimized interview reminder email content
   */
  public async generateInterviewReminder(
    interview: Interview,
    recipientData: {
      name: string;
      email: string;
      role: string;
      timezone?: string;
    },
    locale: string = 'en'
  ): Promise<{
    subject: string;
    html: string;
    text: string;
  }> {
    try {
      const formattedDate = dayjs(interview.scheduled_at)
        .format(this.templateConfig.dateFormat);

      const templateData = {
        recipient: recipientData,
        interview: {
          ...interview,
          formattedDate,
          typeLabel: this.getInterviewTypeLabel(interview.type, locale),
          statusLabel: this.getInterviewStatusLabel(interview.status, locale),
          location: this.formatLocation(interview.location),
          duration: `${interview.duration_minutes} minutes`
        },
        meetingInfo: interview.meeting_platform_metadata || {},
        isVideoInterview: interview.mode === 'VIDEO',
        isInPersonInterview: interview.mode === 'IN_PERSON',
        reminderTime: dayjs(interview.scheduled_at).subtract(24, 'hours').format('MMMM D'),
        callToAction: {
          confirmUrl: `${this.templateConfig.baseUrl}/interviews/${interview.id}/confirm`,
          rescheduleUrl: `${this.templateConfig.baseUrl}/interviews/${interview.id}/reschedule`
        }
      };

      const html = await this.compileTemplate('interview-reminder', templateData, locale);
      const text = await this.compileTemplate('interview-reminder-text', templateData, locale);
      const subject = this.getLocalizedString('interview.reminder.subject', locale, {
        type: templateData.interview.typeLabel,
        date: formattedDate
      });

      return {
        subject,
        html: this.ensureAccessibility(html),
        text
      };
    } catch (error) {
      throw handleError(error, {
        context: 'ReminderEmailTemplate.generateInterviewReminder',
        interviewId: interview.id,
        recipientEmail: recipientData.email
      });
    }
  }

  /**
   * Generates reminder content for pending actions with priority handling
   */
  public async generateActionReminder(
    actionData: {
      type: string;
      deadline: Date;
      priority: 'high' | 'medium' | 'low';
      description: string;
      actionUrl: string;
    },
    recipientData: {
      name: string;
      email: string;
      role: string;
    },
    locale: string = 'en'
  ): Promise<{
    subject: string;
    html: string;
    text: string;
  }> {
    try {
      const formattedDeadline = dayjs(actionData.deadline)
        .format(this.templateConfig.dateFormat);

      const templateData = {
        recipient: recipientData,
        action: {
          ...actionData,
          formattedDeadline,
          priorityLabel: this.getPriorityLabel(actionData.priority, locale),
          isUrgent: actionData.priority === 'high'
        },
        callToAction: {
          actionUrl: actionData.actionUrl,
          dashboardUrl: `${this.templateConfig.baseUrl}/dashboard`
        }
      };

      const html = await this.compileTemplate('action-reminder', templateData, locale);
      const text = await this.compileTemplate('action-reminder-text', templateData, locale);
      const subject = this.getLocalizedString('action.reminder.subject', locale, {
        type: actionData.type,
        deadline: formattedDeadline
      });

      return {
        subject,
        html: this.ensureAccessibility(html),
        text
      };
    } catch (error) {
      throw handleError(error, {
        context: 'ReminderEmailTemplate.generateActionReminder',
        actionType: actionData.type,
        recipientEmail: recipientData.email
      });
    }
  }

  /**
   * Compiles and caches templates with performance optimization
   */
  private async compileTemplate(
    templateName: string,
    data: Record<string, any>,
    locale: string
  ): Promise<string> {
    const cacheKey = `${templateName}-${locale}`;

    try {
      let template = this.compiledTemplates.get(cacheKey);

      if (!template) {
        const templateContent = await this.loadTemplate(templateName, locale);
        template = handlebars.compile(templateContent, {
          strict: true,
          preventIndent: true,
          noEscape: false
        });
        this.compiledTemplates.set(cacheKey, template);
      }

      return template(data);
    } catch (error) {
      throw handleError(error, {
        context: 'ReminderEmailTemplate.compileTemplate',
        templateName,
        locale
      });
    }
  }

  private initializeTemplates(): void {
    // Register base templates
    this.registerTemplate('interview-reminder', this.getInterviewReminderTemplate());
    this.registerTemplate('interview-reminder-text', this.getInterviewReminderTextTemplate());
    this.registerTemplate('action-reminder', this.getActionReminderTemplate());
    this.registerTemplate('action-reminder-text', this.getActionReminderTextTemplate());

    // Initialize localizations
    this.initializeLocalizations();
  }

  private registerHelpers(): void {
    handlebars.registerHelper('formatDate', (date: Date, format: string) => {
      return dayjs(date).format(format);
    });

    handlebars.registerHelper('ifEquals', function(arg1: any, arg2: any, options: any) {
      return arg1 === arg2 ? options.fn(this) : options.inverse(this);
    });

    handlebars.registerHelper('priorityColor', (priority: string) => {
      const colors = {
        high: '#dc3545',
        medium: '#ffc107',
        low: '#28a745'
      };
      return colors[priority] || colors.medium;
    });
  }

  private getInterviewTypeLabel(type: InterviewType, locale: string): string {
    return this.getLocalizedString(`interview.type.${type.toLowerCase()}`, locale, { fallback: type });
  }

  private getInterviewStatusLabel(status: InterviewStatus, locale: string): string {
    return this.getLocalizedString(`interview.status.${status.toLowerCase()}`, locale, { fallback: status });
  }

  private getPriorityLabel(priority: string, locale: string): string {
    return this.getLocalizedString(`priority.${priority}`, locale, { fallback: priority });
  }

  private formatLocation(location: any): string {
    if (!location) return '';
    
    const parts = [];
    if (location.building) parts.push(location.building);
    if (location.floor) parts.push(`Floor ${location.floor}`);
    if (location.room) parts.push(`Room ${location.room}`);
    if (location.address) parts.push(location.address);
    
    return parts.join(', ');
  }

  private ensureAccessibility(html: string): string {
    // Add accessibility attributes and ensure proper semantic structure
    return html
      .replace(/<a\s/g, '<a role="link" ')
      .replace(/<img\s/g, '<img alt="" role="presentation" ')
      .replace(/<table\s/g, '<table role="presentation" ');
  }

  private getLocalizedString(
    key: string,
    locale: string,
    params: Record<string, any> = {}
  ): string {
    const localeStrings = this.localizations.get(locale) || this.localizations.get('en');
    let template = localeStrings?.[key] || params.fallback || key;

    Object.entries(params).forEach(([param, value]) => {
      template = template.replace(`{{${param}}}`, String(value));
    });

    return template;
  }

  private registerTemplate(name: string, content: string): void {
    try {
      const template = handlebars.compile(content, {
        strict: true,
        preventIndent: true
      });
      this.compiledTemplates.set(name, template);
    } catch (error) {
      throw handleError(error, {
        context: 'ReminderEmailTemplate.registerTemplate',
        templateName: name
      });
    }
  }

  private getInterviewReminderTemplate(): string {
    return `
      <!DOCTYPE html>
      <html lang="{{locale}}">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="color-scheme" content="light dark">
        </head>
        <body style="margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif;">
          <div role="article" aria-roledescription="email" lang="{{locale}}" style="padding: 20px;">
            <h1 style="color: #333; margin-bottom: 20px;">
              {{interview.typeLabel}} Interview Reminder
            </h1>
            
            <p style="margin-bottom: 15px;">
              Hello {{recipient.name}},
            </p>

            <p style="margin-bottom: 20px;">
              This is a reminder for your upcoming {{interview.typeLabel}} interview scheduled for {{interview.formattedDate}}.
            </p>

            {{#if isVideoInterview}}
              <div style="margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 4px;">
                <h2 style="margin-top: 0;">Meeting Details</h2>
                <p style="margin-bottom: 10px;">Platform: {{meetingInfo.platform_name}}</p>
                <p style="margin-bottom: 10px;">Meeting ID: {{meetingInfo.meeting_id}}</p>
                <a href="{{meetingInfo.participant_url}}" style="display: inline-block; padding: 10px 20px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 4px;">
                  Join Meeting
                </a>
              </div>
            {{/if}}

            {{#if isInPersonInterview}}
              <div style="margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 4px;">
                <h2 style="margin-top: 0;">Location Details</h2>
                <p style="margin-bottom: 10px;">{{interview.location}}</p>
              </div>
            {{/if}}

            <div style="margin-top: 30px;">
              <a href="{{callToAction.confirmUrl}}" style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: white; text-decoration: none; border-radius: 4px; margin-right: 10px;">
                Confirm Attendance
              </a>
              <a href="{{callToAction.rescheduleUrl}}" style="display: inline-block; padding: 10px 20px; background-color: #6c757d; color: white; text-decoration: none; border-radius: 4px;">
                Reschedule
              </a>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getInterviewReminderTextTemplate(): string {
    return `
Hello {{recipient.name}},

This is a reminder for your upcoming {{interview.typeLabel}} interview scheduled for {{interview.formattedDate}}.

{{#if isVideoInterview}}
Meeting Details:
- Platform: {{meetingInfo.platform_name}}
- Meeting ID: {{meetingInfo.meeting_id}}
- Join URL: {{meetingInfo.participant_url}}
{{/if}}

{{#if isInPersonInterview}}
Location Details:
{{interview.location}}
{{/if}}

To confirm your attendance, visit: {{callToAction.confirmUrl}}
To reschedule, visit: {{callToAction.rescheduleUrl}}
    `;
  }

  private getActionReminderTemplate(): string {
    return `
      <!DOCTYPE html>
      <html lang="{{locale}}">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="color-scheme" content="light dark">
        </head>
        <body style="margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif;">
          <div role="article" aria-roledescription="email" lang="{{locale}}" style="padding: 20px;">
            <h1 style="color: #333; margin-bottom: 20px;">
              Action Required: {{action.type}}
            </h1>
            
            <p style="margin-bottom: 15px;">
              Hello {{recipient.name}},
            </p>

            <div style="margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 4px;">
              <p style="margin-bottom: 10px;">Priority: 
                <span style="color: {{priorityColor action.priority}}">{{action.priorityLabel}}</span>
              </p>
              <p style="margin-bottom: 10px;">Deadline: {{action.formattedDeadline}}</p>
              <p style="margin-bottom: 10px;">{{action.description}}</p>
            </div>

            <div style="margin-top: 30px;">
              <a href="{{callToAction.actionUrl}}" style="display: inline-block; padding: 10px 20px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 4px;">
                Take Action
              </a>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getActionReminderTextTemplate(): string {
    return `
Hello {{recipient.name}},

Action Required: {{action.type}}

Priority: {{action.priorityLabel}}
Deadline: {{action.formattedDeadline}}

{{action.description}}

Take action here: {{callToAction.actionUrl}}
    `;
  }

  private initializeLocalizations(): void {
    // English localizations
    this.localizations.set('en', {
      'interview.type.technical': 'Technical',
      'interview.type.hr': 'HR',
      'interview.type.behavioral': 'Behavioral',
      'interview.type.system_design': 'System Design',
      'interview.type.final': 'Final',
      'interview.status.scheduled': 'Scheduled',
      'interview.status.confirmed': 'Confirmed',
      'interview.status.completed': 'Completed',
      'priority.high': 'High Priority',
      'priority.medium': 'Medium Priority',
      'priority.low': 'Low Priority',
      'interview.reminder.subject': '{{type}} Interview Reminder - {{date}}',
      'action.reminder.subject': 'Action Required: {{type}} - Due {{deadline}}'
    });

    // Add additional localizations as needed
  }
}