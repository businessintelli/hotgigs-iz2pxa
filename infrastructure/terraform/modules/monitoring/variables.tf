# Terraform variables for monitoring infrastructure configuration
# Configures monitoring stack with DataDog, Grafana, Prometheus and Loki
# Version: hashicorp/terraform ~> 1.0

variable "environment" {
  description = "Deployment environment (production, staging)"
  type        = string
  validation {
    condition     = can(regex("^(production|staging)$", var.environment))
    error_message = "Environment must be either 'production' or 'staging'"
  }
}

variable "monitoring_namespace" {
  description = "Kubernetes namespace for monitoring tools"
  type        = string
  default     = "monitoring"
}

variable "datadog_api_key" {
  description = "DataDog API key for monitoring integration"
  type        = string
  sensitive   = true
}

variable "grafana_admin_password" {
  description = "Admin password for Grafana dashboard access"
  type        = string
  sensitive   = true
}

variable "prometheus_retention_days" {
  description = "Number of days to retain Prometheus metrics data"
  type        = number
  default     = 15
  validation {
    condition     = var.prometheus_retention_days >= 7 && var.prometheus_retention_days <= 90
    error_message = "Prometheus retention days must be between 7 and 90 days"
  }
}

variable "loki_retention_days" {
  description = "Number of days to retain Loki logs data"
  type        = number
  default     = 30
  validation {
    condition     = var.loki_retention_days >= 7 && var.loki_retention_days <= 180
    error_message = "Loki retention days must be between 7 and 180 days"
  }
}

variable "enable_pagerduty_integration" {
  description = "Enable PagerDuty integration for alerts and incident management"
  type        = bool
  default     = true
}

variable "metrics_collection_interval" {
  description = "Interval in seconds for metrics collection across all monitoring tools"
  type        = number
  default     = 30
  validation {
    condition     = var.metrics_collection_interval >= 10 && var.metrics_collection_interval <= 300
    error_message = "Metrics collection interval must be between 10 and 300 seconds"
  }
}