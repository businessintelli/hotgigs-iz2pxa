import handlebars from 'handlebars'; // ^4.7.8
import dayjs from 'dayjs'; // ^1.11.9
import i18next from 'i18next'; // ^23.2.0
import { Interview, InterviewType } from '../../../../types/interviews';

/**
 * Configuration interface for email template generation
 */
interface TemplateConfig {
  locale: string;
  timezone: string;
  templatePaths: {
    schedule: {
      html: string;
      text: string;
    };
    update: {
      html: string;
      text: string;
    };
    reminder: {
      html: string;
      text: string;
    };
    cancellation: {
      html: string;
      text: string;
    };
  };
}

/**
 * Advanced email template generator for interview-related communications
 */
export class InterviewEmailTemplate {
  private readonly templates: {
    schedule: {
      html: HandlebarsTemplateDelegate;
      text: HandlebarsTemplateDelegate;
    };
    update: {
      html: HandlebarsTemplateDelegate;
      text: HandlebarsTemplateDelegate;
    };
    reminder: {
      html: HandlebarsTemplateDelegate;
      text: HandlebarsTemplateDelegate;
    };
    cancellation: {
      html: HandlebarsTemplateDelegate;
      text: HandlebarsTemplateDelegate;
    };
  };

  private readonly config: TemplateConfig;
  private readonly i18n: typeof i18next;

  constructor(config: TemplateConfig) {
    this.config = config;
    this.templates = this.initializeTemplates();
    this.i18n = this.initializeI18n();
    this.registerHelpers();
  }

  /**
   * Generates email content for new interview scheduling
   */
  public async generateScheduleEmail(
    interview: Interview,
    participantData: {
      candidate: { name: string; email: string };
      interviewers: Array<{ name: string; email: string }>;
      preparation_materials?: string[];
    }
  ): Promise<{ html: string; text: string; calendarEvent: string }> {
    const formattedDate = this.formatDateTime(interview.scheduled_at);
    const duration = interview.duration_minutes;
    const location = this.formatLocation(interview);

    const templateData = {
      interview_type: this.i18n.t(`interview_types.${interview.type}`),
      date: formattedDate,
      duration: duration,
      location: location,
      candidate: participantData.candidate,
      interviewers: participantData.interviewers,
      preparation_materials: participantData.preparation_materials,
      meeting_link: interview.meeting_link,
      calendar_event: this.generateCalendarEvent(interview, participantData)
    };

    return {
      html: this.templates.schedule.html(templateData),
      text: this.templates.schedule.text(templateData),
      calendarEvent: templateData.calendar_event
    };
  }

  /**
   * Generates email content for interview updates
   */
  public async generateUpdateEmail(
    updatedInterview: Interview,
    originalInterview: Interview,
    participantData: {
      candidate: { name: string; email: string };
      interviewers: Array<{ name: string; email: string }>;
    }
  ): Promise<{ html: string; text: string; calendarEvent: string }> {
    const changes = this.detectChanges(updatedInterview, originalInterview);
    const formattedDate = this.formatDateTime(updatedInterview.scheduled_at);

    const templateData = {
      changes: changes,
      interview_type: this.i18n.t(`interview_types.${updatedInterview.type}`),
      date: formattedDate,
      duration: updatedInterview.duration_minutes,
      location: this.formatLocation(updatedInterview),
      candidate: participantData.candidate,
      interviewers: participantData.interviewers,
      meeting_link: updatedInterview.meeting_link,
      calendar_event: this.generateCalendarEvent(updatedInterview, participantData)
    };

    return {
      html: this.templates.update.html(templateData),
      text: this.templates.update.text(templateData),
      calendarEvent: templateData.calendar_event
    };
  }

  /**
   * Generates customized reminder emails for upcoming interviews
   */
  public async generateReminderEmail(
    interview: Interview,
    participantData: {
      candidate: { name: string; email: string };
      interviewers: Array<{ name: string; email: string }>;
      preparation_materials?: string[];
    }
  ): Promise<{ html: string; text: string }> {
    const timeUntilInterview = dayjs(interview.scheduled_at).diff(dayjs(), 'hours');
    const formattedDate = this.formatDateTime(interview.scheduled_at);

    const templateData = {
      interview_type: this.i18n.t(`interview_types.${interview.type}`),
      date: formattedDate,
      duration: interview.duration_minutes,
      location: this.formatLocation(interview),
      time_until: timeUntilInterview,
      candidate: participantData.candidate,
      interviewers: participantData.interviewers,
      preparation_materials: participantData.preparation_materials,
      meeting_link: interview.meeting_link
    };

    return {
      html: this.templates.reminder.html(templateData),
      text: this.templates.reminder.text(templateData)
    };
  }

  /**
   * Generates cancellation notifications with rescheduling options
   */
  public async generateCancellationEmail(
    interview: Interview,
    participantData: {
      candidate: { name: string; email: string };
      interviewers: Array<{ name: string; email: string }>;
    },
    reason: string,
    reschedulingOptions?: Array<{ date: Date; duration: number }>
  ): Promise<{ html: string; text: string; calendarEvent: string }> {
    const formattedDate = this.formatDateTime(interview.scheduled_at);

    const templateData = {
      interview_type: this.i18n.t(`interview_types.${interview.type}`),
      date: formattedDate,
      duration: interview.duration_minutes,
      location: this.formatLocation(interview),
      candidate: participantData.candidate,
      interviewers: participantData.interviewers,
      reason: reason,
      rescheduling_options: reschedulingOptions?.map(option => ({
        date: this.formatDateTime(option.date),
        duration: option.duration
      })),
      calendar_event: this.generateCalendarCancellation(interview, participantData)
    };

    return {
      html: this.templates.cancellation.html(templateData),
      text: this.templates.cancellation.text(templateData),
      calendarEvent: templateData.calendar_event
    };
  }

  private initializeTemplates() {
    return {
      schedule: {
        html: handlebars.compile(this.config.templatePaths.schedule.html),
        text: handlebars.compile(this.config.templatePaths.schedule.text)
      },
      update: {
        html: handlebars.compile(this.config.templatePaths.update.html),
        text: handlebars.compile(this.config.templatePaths.update.text)
      },
      reminder: {
        html: handlebars.compile(this.config.templatePaths.reminder.html),
        text: handlebars.compile(this.config.templatePaths.reminder.text)
      },
      cancellation: {
        html: handlebars.compile(this.config.templatePaths.cancellation.html),
        text: handlebars.compile(this.config.templatePaths.cancellation.text)
      }
    };
  }

  private initializeI18n() {
    return i18next.init({
      lng: this.config.locale,
      resources: {
        en: {
          translation: {
            interview_types: {
              [InterviewType.TECHNICAL]: 'Technical Interview',
              [InterviewType.HR]: 'HR Interview',
              [InterviewType.BEHAVIORAL]: 'Behavioral Interview',
              [InterviewType.SYSTEM_DESIGN]: 'System Design Interview',
              [InterviewType.FINAL]: 'Final Interview',
              [InterviewType.PAIR_PROGRAMMING]: 'Pair Programming Session',
              [InterviewType.TAKE_HOME]: 'Take-Home Assignment',
              [InterviewType.CULTURE_FIT]: 'Culture Fit Interview'
            }
          }
        }
      }
    });
  }

  private registerHelpers() {
    handlebars.registerHelper('formatDate', (date: Date) => {
      return dayjs(date).tz(this.config.timezone).format('MMMM D, YYYY h:mm A z');
    });

    handlebars.registerHelper('formatDuration', (minutes: number) => {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours > 0 ? `${hours} hour${hours > 1 ? 's' : ''}` : ''}${
        remainingMinutes > 0 ? ` ${remainingMinutes} minutes` : ''
      }`;
    });
  }

  private formatDateTime(date: Date): string {
    return dayjs(date).tz(this.config.timezone).format('MMMM D, YYYY h:mm A z');
  }

  private formatLocation(interview: Interview): string {
    if (interview.meeting_link) {
      return `Virtual (${interview.meeting_platform || 'Online Meeting'})`;
    }
    if (interview.location) {
      const loc = interview.location;
      return [
        loc.building,
        loc.floor && `Floor ${loc.floor}`,
        loc.room && `Room ${loc.room}`,
        loc.address,
        loc.instructions
      ]
        .filter(Boolean)
        .join(', ');
    }
    return 'Location to be confirmed';
  }

  private generateCalendarEvent(
    interview: Interview,
    participantData: { candidate: { email: string }; interviewers: Array<{ email: string }> }
  ): string {
    // Implementation of iCalendar format generation
    const attendees = [
      participantData.candidate.email,
      ...participantData.interviewers.map(i => i.email)
    ];
    
    return `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${dayjs(interview.scheduled_at).format('YYYYMMDDTHHmmss')}Z
DURATION:PT${interview.duration_minutes}M
SUMMARY:${this.i18n.t(`interview_types.${interview.type}`)}
LOCATION:${this.formatLocation(interview)}
DESCRIPTION:${interview.meeting_link || ''}
ATTENDEE:${attendees.join(';')}
END:VEVENT
END:VCALENDAR`;
  }

  private generateCalendarCancellation(
    interview: Interview,
    participantData: { candidate: { email: string }; interviewers: Array<{ email: string }> }
  ): string {
    // Implementation of iCalendar cancellation format
    return `BEGIN:VCALENDAR
VERSION:2.0
METHOD:CANCEL
BEGIN:VEVENT
UID:${interview.calendar_event_id}
STATUS:CANCELLED
END:VEVENT
END:VCALENDAR`;
  }

  private detectChanges(updated: Interview, original: Interview): Array<{ field: string; old: string; new: string }> {
    const changes = [];
    
    if (updated.scheduled_at.getTime() !== original.scheduled_at.getTime()) {
      changes.push({
        field: 'date',
        old: this.formatDateTime(original.scheduled_at),
        new: this.formatDateTime(updated.scheduled_at)
      });
    }

    if (updated.duration_minutes !== original.duration_minutes) {
      changes.push({
        field: 'duration',
        old: `${original.duration_minutes} minutes`,
        new: `${updated.duration_minutes} minutes`
      });
    }

    if (updated.meeting_link !== original.meeting_link) {
      changes.push({
        field: 'meeting_link',
        old: original.meeting_link || 'None',
        new: updated.meeting_link || 'None'
      });
    }

    return changes;
  }
}