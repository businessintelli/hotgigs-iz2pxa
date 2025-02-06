# Terraform variables definition file for HotGigs infrastructure
# Version: 1.0
# Provider version: hashicorp/terraform ~> 1.0

# Environment variable
variable "environment" {
  description = "Deployment environment (production, staging, development)"
  type        = string

  validation {
    condition     = can(regex("^(production|staging|development)$", var.environment))
    error_message = "Environment must be production, staging, or development"
  }
}

# Project name variable
variable "project_name" {
  description = "Name of the HotGigs project for resource identification"
  type        = string
  default     = "hotgigs"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens"
  }
}

# AWS region variable
variable "aws_region" {
  description = "AWS region for resource deployment"
  type        = string
  default     = "us-east-1"
}

# Domain name variable
variable "domain_name" {
  description = "Primary domain name for the HotGigs application"
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\\.[a-z]{2,}$", var.domain_name))
    error_message = "Domain name must be a valid domain format"
  }
}

# Supabase configuration
variable "supabase_config" {
  description = "Configuration object for Supabase services"
  type = object({
    db_instance_class       = string
    db_storage_size        = number
    enable_replication     = bool
    auth_jwt_expiry        = number
    storage_file_size_limit = number
    function_memory        = number
    function_timeout       = number
  })

  default = {
    db_instance_class       = "db.t3.medium"
    db_storage_size        = 100
    enable_replication     = true
    auth_jwt_expiry        = 3600
    storage_file_size_limit = 10485760  # 10MB in bytes
    function_memory        = 1024
    function_timeout       = 30
  }
}

# Cloudflare configuration
variable "cloudflare_config" {
  description = "Configuration object for Cloudflare services"
  type = object({
    waf_rate_limit_requests = number
    waf_rate_limit_period   = number
    static_asset_cache_ttl  = number
    browser_cache_ttl       = number
    ssl_mode               = string
    min_tls_version        = string
    security_level         = string
  })

  default = {
    waf_rate_limit_requests = 1000
    waf_rate_limit_period   = 60
    static_asset_cache_ttl  = 2592000  # 30 days in seconds
    browser_cache_ttl       = 86400    # 1 day in seconds
    ssl_mode               = "strict"
    min_tls_version        = "1.2"
    security_level         = "high"
  }
}

# Monitoring configuration
variable "monitoring_config" {
  description = "Configuration object for monitoring services"
  type = object({
    datadog_api_key            = string
    enable_logging             = bool
    log_retention_days         = number
    alert_notification_channel = string
  })

  default = {
    datadog_api_key            = null  # Must be provided during deployment
    enable_logging             = true
    log_retention_days         = 30
    alert_notification_channel = "email"
  }

  validation {
    condition     = var.monitoring_config.log_retention_days >= 1 && var.monitoring_config.log_retention_days <= 365
    error_message = "Log retention days must be between 1 and 365"
  }

  sensitive = true  # Marks the entire config as sensitive due to API key
}