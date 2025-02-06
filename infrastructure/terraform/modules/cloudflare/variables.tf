# Required environment variable with validation
variable "environment" {
  type        = string
  description = "Environment name (e.g., production, staging)"
  
  validation {
    condition     = can(regex("^(production|staging|development)$", var.environment))
    error_message = "Environment must be production, staging, or development"
  }
}

# Domain name variable with DNS format validation
variable "domain_name" {
  type        = string
  description = "Primary domain name for the Cloudflare zone"
  
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\\.[a-z]{2,}$", var.domain_name))
    error_message = "Domain name must be a valid DNS name"
  }
}

# SSL/TLS configuration variables
variable "ssl_mode" {
  type        = string
  description = "SSL/TLS encryption mode"
  default     = "strict"
  
  validation {
    condition     = can(regex("^(off|flexible|full|strict)$", var.ssl_mode))
    error_message = "SSL mode must be off, flexible, full, or strict"
  }
}

variable "min_tls_version" {
  type        = string
  description = "Minimum TLS version required for visitors"
  default     = "1.2"
  
  validation {
    condition     = can(regex("^(1.0|1.1|1.2|1.3)$", var.min_tls_version))
    error_message = "TLS version must be 1.0, 1.1, 1.2, or 1.3"
  }
}

# Security configuration variables
variable "security_level" {
  type        = string
  description = "Security level for the zone"
  default     = "medium"
  
  validation {
    condition     = can(regex("^(off|low|medium|high|under_attack)$", var.security_level))
    error_message = "Security level must be off, low, medium, high, or under_attack"
  }
}

# WAF and rate limiting variables
variable "waf_rate_limit_requests" {
  type        = number
  description = "Number of requests allowed per period for rate limiting"
  default     = 1000
  
  validation {
    condition     = var.waf_rate_limit_requests >= 100 && var.waf_rate_limit_requests <= 10000
    error_message = "Rate limit requests must be between 100 and 10000"
  }
}

variable "waf_rate_limit_period" {
  type        = number
  description = "Time period in seconds for rate limiting"
  default     = 60
  
  validation {
    condition     = var.waf_rate_limit_period >= 30 && var.waf_rate_limit_period <= 3600
    error_message = "Rate limit period must be between 30 and 3600 seconds"
  }
}

# Edge function configuration
variable "edge_function_name" {
  type        = string
  description = "Name of the edge function to deploy"
  
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_-]{0,63}$", var.edge_function_name))
    error_message = "Edge function name must be alphanumeric and start with a letter"
  }
}

# Cache configuration variables
variable "static_asset_cache_ttl" {
  type        = number
  description = "Edge cache TTL in seconds for static assets"
  default     = 86400  # 24 hours
  
  validation {
    condition     = var.static_asset_cache_ttl >= 0 && var.static_asset_cache_ttl <= 31536000
    error_message = "Cache TTL must be between 0 and 31536000 seconds (1 year)"
  }
}

variable "browser_cache_ttl" {
  type        = number
  description = "Browser cache TTL in seconds"
  default     = 14400  # 4 hours
  
  validation {
    condition     = var.browser_cache_ttl >= 0 && var.browser_cache_ttl <= 31536000
    error_message = "Browser cache TTL must be between 0 and 31536000 seconds (1 year)"
  }
}

# Common resource tags
variable "common_tags" {
  type        = map(string)
  description = "Common tags to apply to all resources"
  default = {
    managed_by = "terraform"
    module     = "cloudflare"
  }
}