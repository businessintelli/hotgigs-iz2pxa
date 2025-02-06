# Core Terraform configuration
terraform {
  required_version = "~> 1.0"
}

# Supabase Infrastructure Configuration Outputs
output "supabase_configuration" {
  description = "Complete Supabase infrastructure configuration with enhanced security controls"
  value = {
    project_id        = module.supabase.project_id
    api_url          = module.supabase.api_url
    db_connection    = module.supabase.database_connection
    auth_config      = module.supabase.auth_config
    storage_config   = module.supabase.storage_config
    edge_function_config = module.supabase.edge_function_config
    monitoring_config = module.supabase.monitoring_config
  }
  sensitive = true
}

# Cloudflare CDN and Security Configuration Outputs
output "cloudflare_configuration" {
  description = "Cloudflare CDN and security settings with comprehensive security controls"
  value = {
    zone_id          = module.cloudflare.zone_id
    zone_name        = module.cloudflare.zone_name
    edge_function_name = module.cloudflare.edge_function_name
    nameservers      = module.cloudflare.nameservers
    security_settings = module.cloudflare.security_settings
  }
  sensitive = false
}

# Monitoring Infrastructure Configuration Outputs
output "monitoring_configuration" {
  description = "Monitoring and observability infrastructure configuration"
  value = {
    namespace = module.monitoring.monitoring_namespace
    endpoints = {
      grafana    = module.monitoring.grafana_endpoint
      prometheus = module.monitoring.prometheus_endpoint
      loki       = module.monitoring.loki_endpoint
      datadog    = module.monitoring.datadog_dashboard_url
    }
    component_status = module.monitoring.monitoring_status
    retention = {
      prometheus = module.monitoring.prometheus_retention_config
      loki      = module.monitoring.loki_retention_config
    }
    resource_quotas = module.monitoring.monitoring_resource_quotas
    metrics_interval = module.monitoring.metrics_collection_interval
  }
  sensitive = false
}

# Performance Metrics Configuration Output
output "performance_metrics" {
  description = "System performance tracking and SLA monitoring configuration"
  value = {
    monitoring_endpoints = {
      metrics = "${module.monitoring.prometheus_endpoint}/metrics"
      health  = "${module.monitoring.prometheus_endpoint}/health"
      alerts  = "${module.monitoring.prometheus_endpoint}/alerts"
    }
    sla_tracking = {
      uptime_endpoint = "${module.monitoring.grafana_endpoint}/d/uptime"
      response_time_endpoint = "${module.monitoring.grafana_endpoint}/d/response-time"
      error_rate_endpoint = "${module.monitoring.grafana_endpoint}/d/error-rate"
    }
    collection_interval = module.monitoring.metrics_collection_interval
  }
  sensitive = false
}

# Security Configuration Output
output "security_configuration" {
  description = "Security and access control configuration for infrastructure services"
  value = {
    auth_endpoints = {
      jwt_issuer = module.supabase.auth_config.jwt_issuer
      oauth_endpoints = module.supabase.auth_config.oauth_endpoints
    }
    waf_config = {
      rules_enabled = module.cloudflare.security_settings.waf_enabled
      security_level = module.cloudflare.security_settings.security_level
    }
    ssl_config = {
      mode = module.cloudflare.security_settings.ssl_mode
      min_tls_version = module.cloudflare.security_settings.min_tls_version
    }
  }
  sensitive = false
}

# Infrastructure Integration Output
output "integration_configuration" {
  description = "Integration endpoints and configuration for service connectivity"
  value = {
    api_endpoints = {
      base_url = module.supabase.api_url
      edge_functions = module.supabase.edge_function_config.base_url
      storage = module.supabase.storage_config.cdn_url
    }
    cdn_endpoints = {
      zone_url = "https://${module.cloudflare.zone_name}"
      edge_function_route = module.cloudflare.edge_function_route
    }
    monitoring_endpoints = {
      metrics = module.monitoring.prometheus_endpoint
      logs = module.monitoring.loki_endpoint
      dashboards = module.monitoring.grafana_endpoint
    }
  }
  sensitive = false
}