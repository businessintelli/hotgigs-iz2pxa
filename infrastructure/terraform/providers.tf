# Provider configuration for HotGigs infrastructure
# Version: 1.0
# Last Updated: 2024

terraform {
  # Specify required provider versions
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    datadog = {
      source  = "datadog/datadog"
      version = "~> 3.0"
    }
  }

  required_version = ">= 1.0"
}

# AWS Provider Configuration
provider "aws" {
  region = var.aws_region

  # Default tags applied to all resources
  default_tags {
    tags = {
      Environment        = var.environment
      Project           = "hotgigs"
      ManagedBy         = "terraform"
      SecurityLevel     = "high"
      DataClassification = "sensitive"
      BackupPolicy      = "daily"
      CostCenter        = "engineering"
    }
  }

  # Assume role configuration for secure access
  assume_role {
    role_arn     = var.aws_role_arn
    session_name = "terraform-hotgigs-${var.environment}"
  }

  # Security controls
  allowed_account_ids = [var.aws_account_id]
  max_retries        = 5
}

# Cloudflare Provider Configuration
provider "cloudflare" {
  api_token = var.cloudflare_config.api_token

  # Security and performance settings
  min_tls_version = "1.3"
  retries         = 3
  rps             = 10

  # Logging and monitoring
  api_client_logging    = true
  api_user_service_key  = var.cloudflare_config.service_key
  account_id           = var.cloudflare_config.account_id
  api_hostname         = "api.cloudflare.com"
}

# DataDog Provider Configuration
provider "datadog" {
  api_key = var.monitoring_config.datadog_api_key
  app_key = var.monitoring_config.datadog_app_key
  api_url = "https://api.datadoghq.com/"

  # Provider settings
  validate            = true
  retry_timeout       = 60
  retry_max_attempts  = 4
  compression         = "gzip"
  log_level          = "warn"

  # Metrics configuration
  metrics_prefix = "hotgigs.${var.environment}"

  # Default tags for all DataDog resources
  tags = [
    "env:${var.environment}",
    "project:hotgigs",
    "managed-by:terraform"
  ]
}