import { createClient } from '@supabase/supabase-js'; // ^2.38.0
import { FileUploadError } from '@supabase/storage-js'; // ^2.5.4
import ClamScan from 'clamscan'; // ^2.1.2
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0
import { BaseEntity } from '../../types/common';
import { storageConfig } from '../../config/storage';
import { Logger } from '../../utils/logger';

interface FileMetadata extends BaseEntity {
  originalName: string;
  mimeType: string;
  size: number;
  checksum: string;
  bucket: string;
  path: string;
  isEncrypted: boolean;
  scanStatus: 'clean' | 'infected' | 'pending';
}

interface FileUploadOptions {
  customPath?: string;
  metadata?: Record<string, unknown>;
  encryption?: boolean;
  cacheControl?: string;
}

interface FileDownloadOptions {
  transform?: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
  };
  forceDownload?: boolean;
}

class FileHandler {
  private supabaseClient;
  private virusScanner;
  private logger: Logger;
  private retryAttempts = 3;
  private retryDelay = 1000;

  constructor() {
    // Initialize Supabase client
    this.supabaseClient = createClient(
      process.env.SUPABASE_STORAGE_URL!,
      process.env.SUPABASE_STORAGE_KEY!,
      {
        auth: { persistSession: false }
      }
    );

    // Initialize virus scanner
    this.virusScanner = new ClamScan({
      removeInfected: true,
      quarantinePath: storageConfig.security.virusScanning.quarantinePath,
      debugMode: process.env.NODE_ENV === 'development'
    });

    // Initialize logger
    this.logger = new Logger({ name: 'FileHandler' });
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    attempt = 1
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= this.retryAttempts) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      return this.retryOperation(operation, attempt + 1);
    }
  }

  private async calculateChecksum(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async validateFile(
    file: File,
    bucketName: keyof typeof storageConfig.buckets
  ): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];
    const config = storageConfig.buckets[bucketName];

    // Check file size
    if (!storageConfig.limits.maxFileSize[bucketName]) {
      issues.push(`Invalid bucket: ${bucketName}`);
      return { valid: false, issues };
    }

    if (file.size > storageConfig.limits.maxFileSize[bucketName]) {
      issues.push(`File size exceeds limit of ${storageConfig.limits.maxFileSize[bucketName]} bytes`);
    }

    // Validate file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!storageConfig.limits.allowedTypes[bucketName].includes(`.${fileExtension}`)) {
      issues.push(`File type .${fileExtension} not allowed`);
    }

    // Virus scan if enabled
    if (storageConfig.security.virusScanning.enabled) {
      try {
        const isClean = await this.virusScanner.isClean(file);
        if (!isClean) {
          issues.push('File failed virus scan');
        }
      } catch (error) {
        this.logger.error('Virus scan failed', { error });
        issues.push('Virus scan failed');
      }
    }

    return { valid: issues.length === 0, issues };
  }

  async uploadFile(
    file: File,
    bucketName: keyof typeof storageConfig.buckets,
    path: string,
    options: FileUploadOptions = {}
  ): Promise<{ url: string; key: string; metadata: FileMetadata }> {
    // Validate file
    const validation = await this.validateFile(file, bucketName);
    if (!validation.valid) {
      throw new FileUploadError(`File validation failed: ${validation.issues.join(', ')}`);
    }

    const bucket = storageConfig.buckets[bucketName];
    const fileId = uuidv4();
    const fileExtension = file.name.split('.').pop();
    const key = `${options.customPath || path}/${fileId}.${fileExtension}`;
    const checksum = await this.calculateChecksum(file);

    const metadata: FileMetadata = {
      id: fileId as any,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      checksum,
      bucket: bucketName,
      path: key,
      isEncrypted: options.encryption ?? bucket.encryption,
      scanStatus: 'clean',
      created_at: new Date(),
      updated_at: new Date()
    };

    try {
      await this.retryOperation(async () => {
        const { error } = await this.supabaseClient.storage
          .from(bucketName)
          .upload(key, file, {
            cacheControl: options.cacheControl || storageConfig.cdn.cacheControl,
            upsert: false,
            contentType: file.type,
            duplex: 'half',
            metadata: {
              ...options.metadata,
              ...metadata,
              encryption: metadata.isEncrypted
            }
          });

        if (error) throw error;
      });

      const url = storageConfig.cdn.enabled
        ? `${storageConfig.cdn.domain}/${bucketName}/${key}`
        : await this.generateSignedUrl(bucketName, key);

      this.logger.info('File uploaded successfully', { 
        bucket: bucketName,
        key,
        size: file.size,
        metadata 
      });

      return { url, key, metadata };
    } catch (error) {
      this.logger.error('File upload failed', { error, bucket: bucketName, key });
      throw error;
    }
  }

  async downloadFile(
    bucketName: keyof typeof storageConfig.buckets,
    key: string,
    options: FileDownloadOptions = {}
  ): Promise<{ url: string; metadata: FileMetadata; headers: Record<string, string> }> {
    try {
      // Verify file exists and get metadata
      const { data: metadata, error } = await this.supabaseClient.storage
        .from(bucketName)
        .getMetadata(key);

      if (error || !metadata) {
        throw new Error(`File not found: ${key}`);
      }

      const headers: Record<string, string> = {
        'Cache-Control': storageConfig.cdn.cacheControl,
        'Content-Type': metadata.contentType || 'application/octet-stream'
      };

      if (options.forceDownload) {
        headers['Content-Disposition'] = `attachment; filename="${metadata.originalName}"`;
      }

      let url: string;
      if (storageConfig.cdn.enabled && !metadata.encryption) {
        url = `${storageConfig.cdn.domain}/${bucketName}/${key}`;
        if (options.transform) {
          const params = new URLSearchParams();
          if (options.transform.width) params.append('width', options.transform.width.toString());
          if (options.transform.height) params.append('height', options.transform.height.toString());
          if (options.transform.quality) params.append('quality', options.transform.quality.toString());
          if (options.transform.format) params.append('format', options.transform.format);
          url += `?${params.toString()}`;
        }
      } else {
        url = await this.generateSignedUrl(bucketName, key);
      }

      this.logger.info('File download URL generated', { bucket: bucketName, key });

      return { 
        url,
        metadata: metadata as FileMetadata,
        headers
      };
    } catch (error) {
      this.logger.error('File download failed', { error, bucket: bucketName, key });
      throw error;
    }
  }

  async generateSignedUrl(
    bucketName: keyof typeof storageConfig.buckets,
    key: string,
    expirySeconds: number = storageConfig.security.signedUrlExpiry,
    options: Record<string, unknown> = {}
  ): Promise<{ url: string; expires: number; headers: Record<string, string> }> {
    try {
      const { data, error } = await this.supabaseClient.storage
        .from(bucketName)
        .createSignedUrl(key, expirySeconds, options);

      if (error || !data) {
        throw error || new Error('Failed to generate signed URL');
      }

      const expires = Date.now() + (expirySeconds * 1000);
      const headers = {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      };

      this.logger.info('Signed URL generated', { 
        bucket: bucketName,
        key,
        expirySeconds
      });

      return {
        url: data.signedUrl,
        expires,
        headers
      };
    } catch (error) {
      this.logger.error('Signed URL generation failed', { 
        error,
        bucket: bucketName,
        key
      });
      throw error;
    }
  }
}

export { FileHandler, type FileMetadata, type FileUploadOptions, type FileDownloadOptions };