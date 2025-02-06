# Terraform variables configuration for HotGigs staging environment
# Version: 1.0
# Provider: hashicorp/terraform ~> 1.0

# Core environment settings
environment  = "staging"
project_name = "hotgigs"
aws_region   = "us-east-1"
domain_name  = "staging.hotgigs.io"

# Supabase configuration for staging environment
# Optimized for pre-production testing with moderate resource allocation
supabase_config = {
  db_instance_class       = "db.t3.medium"    # Moderate performance instance for staging
  db_storage_size        = 50                 # 50GB storage for staging data
  enable_replication     = false              # Disable replication for staging
  auth_jwt_expiry        = 3600              # 1 hour token expiry
  storage_file_size_limit = 10485760         # 10MB file size limit
  function_memory        = 1024              # 1GB memory for edge functions
  function_timeout       = 30                # 30 second function timeout
}

# Cloudflare CDN and security configuration for staging
cloudflare_config = {
  waf_rate_limit_requests = 1000             # Requests per period
  waf_rate_limit_period   = 60               # Period in seconds
  static_asset_cache_ttl  = 2592000          # 30 days cache for static assets
  browser_cache_ttl       = 86400            # 1 day browser cache
  ssl_mode               = "strict"          # Enforce HTTPS
  min_tls_version        = "1.2"            # Minimum TLS version
  security_level         = "high"            # High security WAF rules
}

# Monitoring and logging configuration for staging
monitoring_config = {
  enable_logging             = true          # Enable comprehensive logging
  log_retention_days         = 30            # 30 days log retention
  alert_notification_channel = "email"       # Email notifications for alerts
}