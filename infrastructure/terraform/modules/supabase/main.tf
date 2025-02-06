# Core Terraform configuration with strict version constraints
terraform {
  required_version = ">= 1.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Local variables for resource naming and tagging
locals {
  resource_prefix = "${var.project_name}-${var.environment}"
  common_tags = {
    Environment       = var.environment
    Project          = var.project_name
    ManagedBy        = "terraform"
    SecurityLevel    = "high"
    DataProtection   = "encrypted"
    ComplianceStatus = "gdpr-ccpa-compliant"
  }
}

# Retrieve current AWS region information
data "aws_region" "current" {}

# Supabase Project Resource
resource "aws_supabase_project" "main" {
  name = local.resource_prefix
  region = data.aws_region.current.name

  # Database Configuration
  database_config {
    instance_class = var.supabase_config.database.instance_class
    storage_size  = var.supabase_config.database.storage_size_gb
    
    backup_config {
      retention_days = var.supabase_config.database.backup_retention_days
      point_in_time_recovery = true
    }

    replication_config {
      enabled = var.supabase_config.database.enable_replication
      replica_count = var.supabase_config.database.replica_count
      replica_regions = ["eu-west-1", "ap-southeast-1"]
    }

    performance_config {
      max_connections = var.supabase_config.database.max_connections
      enable_performance_insights = true
      enable_auto_vacuum = true
    }
  }

  # Authentication Service Configuration
  auth_config {
    jwt_config {
      expiry_seconds = var.supabase_config.auth.jwt_expiry_seconds
      refresh_token_expiry_seconds = var.supabase_config.auth.jwt_refresh_seconds
    }

    security_config {
      enable_mfa = var.supabase_config.auth.enable_mfa
      rate_limit_attempts = var.supabase_config.auth.rate_limit_attempts
      password_min_length = 12
      require_email_verification = true
    }
  }

  # Storage Configuration
  storage_config {
    max_file_size_bytes = var.supabase_config.storage.max_file_size_bytes
    allowed_mime_types  = var.supabase_config.storage.allowed_mime_types
    
    cdn_config {
      enabled = var.supabase_config.storage.enable_cdn
      ttl_seconds = 3600
    }

    lifecycle_config {
      expiry_days = var.supabase_config.storage.file_expiry_days
      versioning_enabled = true
    }

    encryption_config {
      sse_algorithm = "AES256"
      kms_key_id = aws_kms_key.storage_key.id
    }
  }

  # Edge Functions Configuration
  edge_functions_config {
    memory_size_mb = var.supabase_config.edge_functions.memory_mb
    timeout_seconds = var.supabase_config.edge_functions.timeout_seconds
    
    scaling_config {
      max_instances = var.supabase_config.edge_functions.max_instances
      min_instances = 1
    }

    logging_config {
      enabled = var.supabase_config.edge_functions.enable_logging
      retention_days = 30
    }
  }

  # Monitoring Configuration
  monitoring_config {
    metrics_enabled = true
    metrics_retention_days = 90
    
    alerting_config {
      email = var.monitoring_config.alert_email
      cpu_threshold_percent = 80
      memory_threshold_percent = 80
      storage_threshold_percent = 85
    }

    logging_config {
      audit_logging_enabled = true
      slow_query_logging_enabled = true
      error_logging_enabled = true
    }
  }

  # Security Configuration
  security_config {
    network_access {
      ip_allow_list = ["0.0.0.0/0"]  # Should be restricted in production
      enable_ssl = true
      ssl_enforcement = true
    }

    encryption_at_rest {
      enabled = true
      kms_key_id = aws_kms_key.database_key.id
    }
  }

  tags = local.common_tags
}

# KMS Key for Database Encryption
resource "aws_kms_key" "database_key" {
  description = "${local.resource_prefix}-database-encryption"
  enable_key_rotation = true
  deletion_window_in_days = 30
  tags = local.common_tags
}

# KMS Key for Storage Encryption
resource "aws_kms_key" "storage_key" {
  description = "${local.resource_prefix}-storage-encryption"
  enable_key_rotation = true
  deletion_window_in_days = 30
  tags = local.common_tags
}

# Outputs
output "project_id" {
  description = "The ID of the Supabase project"
  value       = aws_supabase_project.main.id
}

output "api_url" {
  description = "The API URL for the Supabase project"
  value       = aws_supabase_project.main.api_url
  sensitive   = true
}

output "db_connection" {
  description = "Database connection details"
  value = {
    host     = aws_supabase_project.main.db_host
    port     = aws_supabase_project.main.db_port
    ssl_mode = "require"
  }
  sensitive = true
}

output "storage_bucket" {
  description = "Storage bucket details"
  value       = aws_supabase_project.main.storage_bucket
  sensitive   = true
}