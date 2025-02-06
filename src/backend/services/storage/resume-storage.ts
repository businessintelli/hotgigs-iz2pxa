import { createClient } from '@supabase/supabase-js'; // ^2.38.0
import clamav from 'clamav.js'; // ^1.0.0
import { FileHandler, type FileMetadata, type FileUploadOptions } from './file-handler';
import { storageConfig } from '../../config/storage';
import { Logger } from '../../utils/logger';
import { ErrorCode } from '../../types/common';

interface ResumeMetadata extends FileMetadata {
  candidateId: string;
  parseStatus?: 'pending' | 'completed' | 'failed';
  contentType: string;
  retention: {
    expiryDate: Date;
    policy: string;
  };
}

interface BulkUploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
  metadata?: ResumeMetadata;
}

class ResumeStorage {
  private fileHandler: FileHandler;
  private logger: Logger;
  private bucketName: keyof typeof storageConfig.buckets = 'resumes';
  private retentionPolicy: typeof storageConfig.buckets.resumes;
  private readonly CONCURRENT_UPLOADS = 5;

  constructor() {
    this.fileHandler = new FileHandler();
    this.logger = new Logger({ name: 'ResumeStorage' });
    this.retentionPolicy = storageConfig.buckets.resumes;

    // Validate bucket configuration
    if (!storageConfig.buckets.resumes) {
      throw new Error('Resume bucket configuration not found');
    }
  }

  private async validateResumeFile(file: File): Promise<void> {
    const validation = await this.fileHandler.validateFile(file, this.bucketName);
    
    if (!validation.valid) {
      this.logger.error('Resume validation failed', { issues: validation.issues });
      throw new Error(`Resume validation failed: ${validation.issues.join(', ')}`);
    }

    if (file.size > storageConfig.limits.maxFileSize.resumes) {
      throw new Error(`File size exceeds maximum limit of ${storageConfig.limits.maxFileSize.resumes} bytes`);
    }

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!storageConfig.limits.allowedTypes.resumes.includes(`.${fileExtension}`)) {
      throw new Error(`File type .${fileExtension} not allowed for resumes`);
    }
  }

  private generateStorageKey(candidateId: string, fileName: string): string {
    const fileExtension = fileName.split('.').pop();
    const timestamp = new Date().getTime();
    return `${this.retentionPolicy.path}/${candidateId}/${timestamp}.${fileExtension}`;
  }

  async uploadResume(
    file: File,
    candidateId: string,
    metadata: Record<string, unknown> = {}
  ): Promise<{ url: string; key: string; metadata: ResumeMetadata }> {
    try {
      this.logger.info('Starting resume upload', { candidateId, fileName: file.name });
      
      await this.validateResumeFile(file);
      
      const storageKey = this.generateStorageKey(candidateId, file.name);
      const uploadOptions: FileUploadOptions = {
        customPath: this.retentionPolicy.path,
        metadata: {
          ...metadata,
          candidateId,
          parseStatus: 'pending',
          retention: {
            expiryDate: new Date(Date.now() + (this.retentionPolicy.retentionDays * 24 * 60 * 60 * 1000)),
            policy: 'resume-retention'
          }
        },
        encryption: this.retentionPolicy.encryption,
        cacheControl: 'private, no-cache'
      };

      const { url, key, metadata: fileMetadata } = await this.fileHandler.uploadFile(
        file,
        this.bucketName,
        storageKey,
        uploadOptions
      );

      const resumeMetadata: ResumeMetadata = {
        ...fileMetadata,
        candidateId,
        parseStatus: 'pending',
        contentType: file.type,
        retention: uploadOptions.metadata.retention as any
      };

      this.logger.info('Resume uploaded successfully', {
        candidateId,
        key,
        metadata: resumeMetadata
      });

      return { url, key, metadata: resumeMetadata };
    } catch (error) {
      this.logger.error('Resume upload failed', {
        error,
        candidateId,
        fileName: file.name
      });
      throw error;
    }
  }

  async bulkUploadResumes(
    files: File[],
    candidateIds: string[],
    metadata: Record<string, unknown>[] = []
  ): Promise<BulkUploadResult[]> {
    if (files.length !== candidateIds.length) {
      throw new Error('Number of files must match number of candidate IDs');
    }

    this.logger.info('Starting bulk resume upload', { 
      fileCount: files.length 
    });

    const results: BulkUploadResult[] = [];
    const chunks = Array.from({ length: Math.ceil(files.length / this.CONCURRENT_UPLOADS) }, 
      (_, i) => files.slice(i * this.CONCURRENT_UPLOADS, (i + 1) * this.CONCURRENT_UPLOADS)
    );

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (file, index) => {
        const actualIndex = chunks.indexOf(chunk) * this.CONCURRENT_UPLOADS + index;
        try {
          const result = await this.uploadResume(
            file,
            candidateIds[actualIndex],
            metadata[actualIndex]
          );
          return {
            success: true,
            ...result
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Upload failed'
          };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    this.logger.info('Bulk resume upload completed', {
      total: files.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });

    return results;
  }

  async getResume(key: string): Promise<{ url: string; metadata: ResumeMetadata }> {
    try {
      const { url, metadata } = await this.fileHandler.downloadFile(
        this.bucketName,
        key,
        { forceDownload: true }
      );

      return {
        url,
        metadata: metadata as ResumeMetadata
      };
    } catch (error) {
      this.logger.error('Resume retrieval failed', { error, key });
      throw error;
    }
  }

  async deleteResume(key: string): Promise<void> {
    try {
      await this.fileHandler.deleteFile(this.bucketName, key);
      this.logger.info('Resume deleted successfully', { key });
    } catch (error) {
      this.logger.error('Resume deletion failed', { error, key });
      throw error;
    }
  }
}

export { ResumeStorage, type ResumeMetadata, type BulkUploadResult };