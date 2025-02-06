# Core Terraform configuration with strict version constraints
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
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

  # Remote state configuration with encryption and locking
  backend "s3" {
    bucket         = "${var.state_bucket}"
    key            = "terraform.tfstate"
    region         = "${var.aws_region}"
    encrypt        = true
    dynamodb_table = "${var.lock_table}"
    versioning     = true
    access_logging = true
  }
}

# Common resource tags
locals {
  common_tags = {
    Environment       = var.environment
    Project          = var.project_name
    ManagedBy        = "terraform"
    CostCenter       = var.cost_center
    DataClassification = var.data_classification
    BackupPolicy     = var.backup_policy
  }
}

# Retrieve current AWS region information
data "aws_region" "current" {}

# Supabase infrastructure module
module "supabase" {
  source = "./modules/supabase"

  environment = var.environment
  project_name = var.project_name
  
  supabase_config = {
    database = {
      instance_class = "db.t3.large"
      storage_size_gb = 100
      max_connections = 100
      backup_retention_days = 30
      enable_replication = true
      replica_count = 2
    }
    auth = {
      jwt_expiry_seconds = 3600
      jwt_refresh_seconds = 43200
      enable_mfa = true
      rate_limit_attempts = 5
    }
    storage = {
      max_file_size_bytes = 10485760
      enable_cdn = true
      file_expiry_days = 7
      allowed_mime_types = ["application/pdf", "image/jpeg", "image/png"]
    }
    edge_functions = {
      memory_mb = 1024
      timeout_seconds = 30
      max_instances = 100
      enable_logging = true
    }
  }

  monitoring_config = {
    enable_metrics = true
    metrics_retention_days = 90
    alert_email = "alerts@hotgigs.io"
  }

  tags = local.common_tags
}

# Cloudflare CDN and security module
module "cloudflare" {
  source = "./modules/cloudflare"

  environment = var.environment
  domain_name = var.domain_name
  
  ssl_mode = "strict"
  min_tls_version = "1.2"
  security_level = "high"
  
  waf_rate_limit_requests = 1000
  waf_rate_limit_period = 60
  
  edge_function_name = "hotgigs-edge"
  
  static_asset_cache_ttl = 86400
  browser_cache_ttl = 14400
  
  common_tags = local.common_tags
}

# Monitoring infrastructure module
module "monitoring" {
  source = "./modules/monitoring"

  environment = var.environment
  monitoring_namespace = "hotgigs-monitoring"
  
  datadog_api_key = var.datadog_api_key
  grafana_admin_password = var.grafana_admin_password
  
  prometheus_retention_days = 15
  loki_retention_days = 30
  enable_pagerduty_integration = true
  metrics_collection_interval = 30
}

# Output Supabase infrastructure details
output "supabase_outputs" {
  description = "Supabase infrastructure details"
  value = {
    api_url = module.supabase.api_url
    project_id = module.supabase.project_id
    db_connection_string = module.supabase.db_connection
    replica_endpoints = module.supabase.storage_bucket
  }
  sensitive = true
}

# Output monitoring endpoints
output "monitoring_endpoints" {
  description = "Monitoring infrastructure endpoints"
  value = {
    grafana_url = "${var.domain_name}/grafana"
    prometheus_url = "${var.domain_name}/prometheus"
    pagerduty_service_key = module.monitoring.pagerduty_service_key
    alert_endpoints = {
      datadog = module.monitoring.datadog_endpoint
      prometheus = module.monitoring.prometheus_endpoint
      loki = module.monitoring.loki_endpoint
    }
  }
  sensitive = true
}