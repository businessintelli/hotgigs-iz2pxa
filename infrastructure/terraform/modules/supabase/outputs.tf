# Core Terraform functionality for output definitions
terraform {
  required_version = "~> 1.0"
}

# Project identifier output
output "project_id" {
  description = "Unique identifier for the Supabase project"
  value       = supabase_project.main.id
  sensitive   = false
}

# API endpoint output
output "api_url" {
  description = "Base URL for Supabase API endpoints"
  value       = supabase_project.main.api_url
  sensitive   = false
}

# Database connection details output
output "database_connection" {
  description = "PostgreSQL database connection details with enhanced security"
  value = {
    host      = supabase_project.main.db_host
    port      = supabase_project.main.db_port
    name      = supabase_project.main.db_name
    ssl_mode  = "require"
  }
  sensitive = true
}

# Authentication configuration output
output "auth_config" {
  description = "Authentication service configuration with JWT and role keys"
  value = {
    jwt_secret       = supabase_project.main.jwt_secret
    service_role_key = supabase_project.main.service_role_key
    anon_key        = supabase_project.main.anon_key
  }
  sensitive = true
}

# Storage service configuration output
output "storage_config" {
  description = "Storage service configuration with CDN endpoints"
  value = {
    bucket_name = supabase_project.main.storage_bucket
    cdn_url     = supabase_project.main.storage_cdn_url
    region      = supabase_project.main.region
  }
  sensitive = false
}

# Edge function configuration output
output "edge_function_config" {
  description = "Edge function deployment configuration and endpoints"
  value = {
    base_url         = supabase_project.main.functions_url
    function_region  = supabase_project.main.region
    version          = supabase_project.main.version
  }
  sensitive = false
}

# Monitoring configuration output
output "monitoring_config" {
  description = "Monitoring and observability endpoints for system health tracking"
  value = {
    metrics_endpoint = supabase_project.main.metrics_url
    logs_endpoint    = supabase_project.main.logs_url
    traces_endpoint  = supabase_project.main.traces_url
  }
  sensitive = false
}