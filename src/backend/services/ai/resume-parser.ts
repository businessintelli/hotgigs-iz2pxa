import { OpenAI } from 'openai'; // ^4.0.0
import pdfParse from 'pdf-parse'; // ^1.1.1
import mammoth from 'mammoth'; // ^1.6.0
import { FileHandler, FileDownloadOptions } from '../storage/file-handler';
import { Candidate } from '../../types/candidates';
import { Logger } from '../../utils/logger';

interface ParserConfig {
  maxRetries: number;
  maxFileSize: number;
  gptModel: string;
  temperature: number;
}

interface ParseOptions {
  extractEducation?: boolean;
  extractExperience?: boolean;
  extractSkills?: boolean;
  language?: string;
}

interface ExtractionOptions extends ParseOptions {
  maxTokens?: number;
  detailedOutput?: boolean;
}

class ResumeParser {
  private openAIClient: OpenAI;
  private fileHandler: FileHandler;
  private logger: Logger;
  private maxRetries: number;
  private maxFileSize: number;
  private formatParsers: Map<string, (buffer: Buffer) => Promise<string>>;

  constructor(
    openAIClient: OpenAI,
    fileHandler: FileHandler,
    config: ParserConfig = {
      maxRetries: 3,
      maxFileSize: 10485760, // 10MB
      gptModel: 'gpt-4',
      temperature: 0.3
    }
  ) {
    this.openAIClient = openAIClient;
    this.fileHandler = fileHandler;
    this.logger = new Logger({ name: 'ResumeParser' });
    this.maxRetries = config.maxRetries;
    this.maxFileSize = config.maxFileSize;

    // Initialize format-specific parsers
    this.formatParsers = new Map([
      ['application/pdf', this.parsePDF.bind(this)],
      ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', this.parseDocx.bind(this)],
      ['text/plain', this.parseTxt.bind(this)]
    ]);
  }

  async parseResume(
    bucketName: string,
    fileKey: string,
    options: ParseOptions = {}
  ): Promise<Candidate> {
    try {
      // Download file with security checks
      const downloadOptions: FileDownloadOptions = {
        transform: { quality: 100 }
      };

      const { metadata, url } = await this.fileHandler.downloadFile(
        bucketName as any,
        fileKey,
        downloadOptions
      );

      // Validate file size
      if (metadata.size > this.maxFileSize) {
        throw new Error(`File size exceeds maximum limit of ${this.maxFileSize} bytes`);
      }

      // Fetch and validate file content
      const response = await fetch(url);
      const fileBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(fileBuffer);

      // Extract text based on file type
      const text = await this.extractText(buffer, metadata.mimeType);

      // Process through GPT for information extraction
      const candidateInfo = await this.extractInformation(text, {
        ...options,
        maxTokens: 2000,
        detailedOutput: true
      });

      this.logger.info('Resume parsed successfully', {
        fileKey,
        size: metadata.size,
        mimeType: metadata.mimeType
      });

      return candidateInfo;
    } catch (error) {
      this.logger.error('Resume parsing failed', { error, fileKey });
      throw error;
    }
  }

  private async extractText(fileBuffer: Buffer, mimeType: string): Promise<string> {
    const parser = this.formatParsers.get(mimeType);
    if (!parser) {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }

    try {
      const text = await parser(fileBuffer);
      return this.normalizeText(text);
    } catch (error) {
      this.logger.error('Text extraction failed', { error, mimeType });
      throw error;
    }
  }

  private async parsePDF(buffer: Buffer): Promise<string> {
    const data = await pdfParse(buffer);
    return data.text;
  }

  private async parseDocx(buffer: Buffer): Promise<string> {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  private async parseTxt(buffer: Buffer): Promise<string> {
    return buffer.toString('utf-8');
  }

  private normalizeText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\x20-\x7E]/g, ' ')
      .trim();
  }

  private async extractInformation(
    text: string,
    options: ExtractionOptions
  ): Promise<Candidate> {
    const prompt = this.buildExtractionPrompt(text, options);

    try {
      const completion = await this.openAIClient.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert resume parser. Extract structured information from the resume text provided.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: options.maxTokens || 2000
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('Failed to extract information from resume');
      }

      const parsedData = JSON.parse(response);
      return this.validateAndFormatCandidate(parsedData);
    } catch (error) {
      this.logger.error('Information extraction failed', { error });
      throw error;
    }
  }

  private buildExtractionPrompt(text: string, options: ExtractionOptions): string {
    return `
      Extract the following information from the resume in JSON format:
      - Personal Information (name, email, phone, location)
      - Work Experience (company, title, dates, description, skills used)
      - Education (institution, degree, dates, achievements)
      - Skills (technical and soft skills)
      - Certifications
      - Languages

      Resume Text:
      ${text}

      Additional Instructions:
      - Format dates as ISO strings
      - Normalize skill names
      - Validate email formats
      - Extract location information
      ${options.detailedOutput ? '- Include detailed descriptions and achievements' : ''}
    `;
  }

  private validateAndFormatCandidate(data: any): Candidate {
    // Implementation would validate against Candidate interface
    // and ensure all required fields are present and correctly formatted
    return {
      id: '', // Generated by the database
      created_at: new Date(),
      updated_at: new Date(),
      full_name: data.personalInfo.name,
      email: data.personalInfo.email,
      phone: data.personalInfo.phone,
      location: data.personalInfo.location,
      status: 'ACTIVE',
      experience_level: this.determineExperienceLevel(data.experience),
      skills: data.skills,
      experience: data.experience,
      education: data.education,
      resume_url: '', // Set by the calling service
      preferences: {
        preferred_job_types: [],
        preferred_locations: [data.personalInfo.location],
        remote_only: false,
        salary_expectation_min: 0,
        salary_expectation_max: 0,
        open_to_relocation: false,
        preferred_industries: [],
        preferred_companies: [],
        preferred_travel_percentage: 0,
        excluded_industries: []
      },
      match_score: 0,
      metadata: {
        parsed_at: new Date().toISOString(),
        parser_version: '1.0.0',
        confidence_score: 0.95
      }
    };
  }

  private determineExperienceLevel(experience: any[]): string {
    const totalYears = experience.reduce((acc, exp) => {
      const start = new Date(exp.start_date);
      const end = exp.end_date ? new Date(exp.end_date) : new Date();
      return acc + (end.getFullYear() - start.getFullYear());
    }, 0);

    if (totalYears < 2) return 'ENTRY';
    if (totalYears < 5) return 'JUNIOR';
    if (totalYears < 8) return 'MID';
    if (totalYears < 12) return 'SENIOR';
    return 'LEAD';
  }
}

export { ResumeParser, type ParseOptions, type ParserConfig };