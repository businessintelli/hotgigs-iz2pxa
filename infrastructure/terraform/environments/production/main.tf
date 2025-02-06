# Production environment Terraform configuration for HotGigs platform
# Version: hashicorp/terraform ~> 1.0

terraform {
  required_version = "~> 1.0"
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

  # Production state management with encryption and locking
  backend "s3" {
    bucket         = "hotgigs-terraform-state-prod"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "hotgigs-terraform-locks-prod"
    kms_key_id     = "arn:aws:kms:us-east-1:123456789:key/terraform-state-key"
  }
}

# Production environment variables
locals {
  environment = "production"
  project_name = "hotgigs"
  common_tags = {
    Environment = "production"
    Project = "hotgigs"
    ManagedBy = "terraform"
    SecurityLevel = "high"
    ComplianceRequired = "true"
    DataClassification = "sensitive"
  }
}

# Production Supabase configuration
module "supabase" {
  source = "../../main"

  supabase_config = {
    database = {
      instance_class = "db.r6g.2xlarge"
      storage_size_gb = 500
      max_connections = 500
      backup_retention_days = 35
      enable_replication = true
      replica_count = 3
    }
    auth = {
      jwt_expiry_seconds = 3600
      jwt_refresh_seconds = 86400
      enable_mfa = true
      rate_limit_attempts = 5
    }
    storage = {
      max_file_size_bytes = 10485760
      enable_cdn = true
      file_expiry_days = 30
      allowed_mime_types = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ]
    }
    edge_functions = {
      memory_mb = 2048
      timeout_seconds = 60
      max_instances = 200
      enable_logging = true
    }
  }

  monitoring_config = {
    enable_metrics = true
    metrics_retention_days = 90
    alert_email = "alerts@hotgigs.io"
  }
}

# Production Cloudflare configuration
module "cloudflare" {
  source = "../../main"

  cloudflare_config = {
    waf_rate_limit_requests = 1000
    ssl_mode = "strict"
    security_level = "high"
    ddos_protection_settings = {
      enabled = true
      rate_limit_threshold = 1000
      challenge_ttl = 3600
    }
    cdn_optimization_rules = {
      browser_cache_ttl = 14400
      edge_cache_ttl = 86400
      cache_level = "aggressive"
      minify = {
        html = true
        css = true
        js = true
      }
    }
  }
}

# Production monitoring configuration
module "monitoring" {
  source = "../../main"

  monitoring_config = {
    enable_logging = true
    log_retention_days = 90
    alert_notification_channel = "pagerduty"
    metrics_collection_interval = 30
    apm_settings = {
      enabled = true
      sample_rate = 1.0
      environment = "production"
      service_name = "hotgigs"
    }
  }

  datadog_api_key = var.datadog_api_key
  grafana_admin_password = var.grafana_admin_password
  prometheus_retention_days = 30
  loki_retention_days = 90
  enable_pagerduty_integration = true
  metrics_collection_interval = 30
}

# High availability configuration
resource "aws_elasticache_replication_group" "redis_ha" {
  replication_group_id = "hotgigs-prod-cache"
  replication_group_description = "Production Redis cluster for HotGigs"
  node_type = "cache.r6g.xlarge"
  number_cache_clusters = 3
  automatic_failover_enabled = true
  multi_az_enabled = true
  
  tags = local.common_tags
}

# Security group for production database access
resource "aws_security_group" "db_security" {
  name = "hotgigs-prod-db-security"
  description = "Production database security group"
  
  ingress {
    from_port = 5432
    to_port = 5432
    protocol = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
  }

  tags = local.common_tags
}

# Outputs for production environment
output "supabase_endpoints" {
  description = "Production Supabase endpoints"
  value = module.supabase.supabase_outputs
  sensitive = true
}

output "monitoring_endpoints" {
  description = "Production monitoring endpoints"
  value = module.monitoring.monitoring_endpoints
  sensitive = true
}