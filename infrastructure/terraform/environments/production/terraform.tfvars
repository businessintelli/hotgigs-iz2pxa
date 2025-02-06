# Production environment variable definitions for HotGigs infrastructure
# Provider version: hashicorp/terraform ~> 1.0

# Environment identifier
environment = "production"

# Project name for resource identification
project_name = "hotgigs"

# Primary AWS region for production deployment
aws_region = "us-east-1"

# Production domain name
domain_name = "hotgigs.com"

# Supabase production configuration
supabase_config = {
  # High-performance database instance for production workloads
  db_instance_class = "db.r6g.xlarge"
  
  # 500GB storage for production data
  db_storage_size = 500
  
  # Enable cross-region replication for high availability
  enable_replication = true
  
  # JWT token expiry in seconds (1 hour)
  auth_jwt_expiry = 3600
  
  # Maximum file size limit: 10MB
  storage_file_size_limit = 10485760
  
  # Edge function configuration for production
  function_memory = 2048
  function_timeout = 30
  
  # Production database backup configuration
  backup_retention_days = 30
  enable_point_in_time_recovery = true
  
  # Database connection settings
  max_connections = 200
  
  # SSL configuration
  enable_ssl = true
  ssl_mode = "verify-full"
}

# Cloudflare CDN and security configuration
cloudflare_config = {
  # Rate limiting: 1000 requests per minute
  waf_rate_limit_requests = 1000
  waf_rate_limit_period = 60
  
  # Cache TTL settings
  static_asset_cache_ttl = 2592000  # 30 days
  browser_cache_ttl = 86400         # 24 hours
  
  # Security settings
  ssl_mode = "strict"
  min_tls_version = "1.2"
  security_level = "high"
  
  # DDoS and WAF configuration
  ddos_protection = true
  always_use_https = true
  authenticated_origin_pulls = true
  enable_waf_custom_rules = true
  enable_zero_trust = true
}

# Production monitoring configuration
monitoring_config = {
  # Enable comprehensive logging
  enable_logging = true
  log_retention_days = 90
  
  # PagerDuty integration for production alerts
  alert_notification_channel = "pagerduty"
  
  # Datadog API key reference (stored in secure variable)
  datadog_api_key = "${var.datadog_api_key}"
  
  # APM and monitoring features
  enable_apm_tracing = true
  enable_error_tracking = true
  enable_real_user_monitoring = true
  
  # Extended retention for production metrics
  metrics_retention_days = 395
  high_resolution_metrics = true
  
  # Advanced logging features
  enable_log_analytics = true
  enable_audit_logging = true
}