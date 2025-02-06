# Core Terraform configuration with strict version constraints
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    datadog = {
      source  = "datadog/datadog"
      version = "~> 3.0"
    }
  }

  # Remote state configuration with encryption and locking
  backend "s3" {
    bucket         = "hotgigs-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
    versioning     = true
    access_logging = true
  }
}

# Local variables for staging environment
locals {
  environment = "staging"
  domain_name = "staging.hotgigs.io"
  common_tags = {
    Environment        = "staging"
    Project           = "hotgigs"
    ManagedBy         = "terraform"
    CostCenter        = "staging-infrastructure"
    DataClassification = "non-production"
  }
}

# AWS Provider configuration for staging
provider "aws" {
  region = "us-east-1"
  
  default_tags {
    tags = local.common_tags
  }
}

# DataDog Provider configuration for enhanced monitoring
provider "datadog" {
  api_key = var.monitoring_config.datadog_api_key
  app_key = var.monitoring_config.datadog_app_key
  
  validate = true
}

# Root module configuration for staging environment
module "root" {
  source = "../../"

  # Environment configuration
  environment  = local.environment
  project_name = "hotgigs"
  domain_name  = local.domain_name

  # Supabase configuration for staging
  supabase_config = {
    db_instance_class       = "db.t3.medium"
    db_storage_size        = 100
    enable_replication     = true
    auth_jwt_expiry        = 3600
    storage_file_size_limit = 10485760  # 10MB
    function_memory        = 1024
    function_timeout       = 30
  }

  # Cloudflare configuration for staging
  cloudflare_config = {
    waf_rate_limit_requests = 1000
    waf_rate_limit_period   = 60
    static_asset_cache_ttl  = 86400    # 24 hours
    browser_cache_ttl       = 14400    # 4 hours
    ssl_mode               = "strict"
    min_tls_version        = "1.2"
    security_level         = "high"
  }

  # Enhanced monitoring configuration for staging
  monitoring_config = {
    datadog_api_key            = var.monitoring_config.datadog_api_key
    enable_logging             = true
    log_retention_days         = 30
    alert_notification_channel = "email"
    enhanced_metrics          = true
    detailed_tracing          = true
    error_tracking            = true
    performance_monitoring    = true
    alert_thresholds = {
      cpu_utilization    = 80
      memory_utilization = 80
      error_rate         = 5
      latency_p95        = 1000
    }
  }

  # Security configuration for staging
  security_config = {
    waf_rules        = "staging"
    access_controls  = "strict"
    encryption_level = "high"
    audit_logging    = true
    ip_allowlist     = ["0.0.0.0/0"]  # Staging allows all IPs for testing
    ssl_policy       = "modern"
  }

  # Resource limits for staging environment
  resource_limits = {
    max_db_connections = 100
    max_edge_functions = 50
    max_storage_gb     = 100
    max_bandwidth_tb   = 1
  }

  # Cost optimization for staging
  cost_optimization = {
    enable_auto_scaling     = true
    scheduled_scaling      = true
    performance_tier       = "standard"
    backup_retention_days  = 7
    cleanup_unused_resources = true
  }

  tags = local.common_tags
}

# Output Supabase endpoints for staging
output "supabase_endpoint" {
  description = "Supabase API and database endpoints for staging environment"
  value = {
    api_url = module.root.supabase_outputs.api_url
    db_url  = module.root.supabase_outputs.db_connection_string
  }
  sensitive = true
}

# Output monitoring URLs for staging
output "monitoring_urls" {
  description = "Monitoring service endpoints for staging environment"
  value = {
    grafana_url     = "${local.domain_name}/grafana"
    prometheus_url  = "${local.domain_name}/prometheus"
    logging_url     = "${local.domain_name}/logging"
    alerts_url      = "${local.domain_name}/alerts"
    datadog_url     = module.root.monitoring_endpoints.datadog_endpoint
  }
  sensitive = true
}