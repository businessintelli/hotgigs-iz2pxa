# Core Terraform functionality for variable definitions
terraform {
  required_version = "~> 1.0"
}

# Environment identifier variable with validation
variable "environment" {
  description = "Deployment environment identifier (production, staging, development)"
  type        = string

  validation {
    condition     = can(regex("^(production|staging|development)$", var.environment))
    error_message = "Environment must be production, staging, or development"
  }
}

# Project name variable with validation
variable "project_name" {
  description = "Name of the Supabase project for resource identification"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens"
  }
}

# Comprehensive Supabase configuration object
variable "supabase_config" {
  description = "Comprehensive configuration object for all Supabase services"
  type = object({
    database = object({
      instance_class        = string
      storage_size_gb      = number
      max_connections      = number
      backup_retention_days = number
      enable_replication   = bool
      replica_count        = number
    })
    auth = object({
      jwt_expiry_seconds    = number
      jwt_refresh_seconds   = number
      enable_mfa           = bool
      rate_limit_attempts  = number
    })
    storage = object({
      max_file_size_bytes  = number
      enable_cdn          = bool
      file_expiry_days    = number
      allowed_mime_types  = list(string)
    })
    edge_functions = object({
      memory_mb          = number
      timeout_seconds    = number
      max_instances      = number
      enable_logging     = bool
    })
  })

  default = {
    database = {
      instance_class        = "db.t3.large"
      storage_size_gb      = 100
      max_connections      = 100
      backup_retention_days = 30
      enable_replication   = true
      replica_count        = 2
    }
    auth = {
      jwt_expiry_seconds    = 3600
      jwt_refresh_seconds   = 43200
      enable_mfa           = true
      rate_limit_attempts  = 5
    }
    storage = {
      max_file_size_bytes  = 10485760  # 10MB
      enable_cdn          = true
      file_expiry_days    = 7
      allowed_mime_types  = ["application/pdf", "image/jpeg", "image/png"]
    }
    edge_functions = {
      memory_mb          = 1024
      timeout_seconds    = 30
      max_instances      = 100
      enable_logging     = true
    }
  }

  validation {
    condition     = var.supabase_config.database.storage_size_gb >= 100
    error_message = "Database storage must be at least 100GB"
  }
}

# Monitoring configuration object
variable "monitoring_config" {
  description = "Configuration for monitoring and alerting"
  type = object({
    enable_metrics        = bool
    metrics_retention_days = number
    alert_email          = string
  })

  default = {
    enable_metrics        = true
    metrics_retention_days = 90
    alert_email          = "alerts@example.com"
  }

  validation {
    condition     = can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.monitoring_config.alert_email))
    error_message = "Invalid email format for monitoring alerts"
  }
}