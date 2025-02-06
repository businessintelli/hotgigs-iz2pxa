# Terraform outputs for monitoring infrastructure resources
# Exposes endpoints and configurations for monitoring stack components
# Version: hashicorp/terraform ~> 1.0

# Monitoring namespace output
output "monitoring_namespace" {
  description = "Kubernetes namespace where monitoring tools are deployed"
  value       = kubernetes_namespace.monitoring.metadata[0].name
}

# Grafana endpoint output
output "grafana_endpoint" {
  description = "Endpoint URL for accessing Grafana dashboards"
  value       = format("https://%s", helm_release.grafana.status[0].ingress[0].hosts[0])
}

# Prometheus endpoint output
output "prometheus_endpoint" {
  description = "Endpoint URL for Prometheus metrics server"
  value       = format("https://%s", helm_release.prometheus.status[0].ingress[0].hosts[0])
}

# Loki endpoint output
output "loki_endpoint" {
  description = "Endpoint URL for Loki log aggregation"
  value       = format("https://%s", helm_release.loki.status[0].ingress[0].hosts[0])
}

# DataDog dashboard URL output
output "datadog_dashboard_url" {
  description = "URL for accessing the DataDog monitoring dashboard"
  value       = format("https://app.datadoghq.com/dashboard/lists?tag=env:%s", var.environment)
}

# Monitoring components status output
output "monitoring_status" {
  description = "Status of all monitoring components"
  value = {
    grafana    = helm_release.grafana.status[0].status
    prometheus = helm_release.prometheus.status[0].status
    loki       = helm_release.loki.status[0].status
    datadog    = helm_release.datadog.status[0].status
  }
}

# Prometheus retention configuration output
output "prometheus_retention_config" {
  description = "Prometheus metrics retention configuration in days"
  value       = var.prometheus_retention_days
}

# Loki retention configuration output
output "loki_retention_config" {
  description = "Loki logs retention configuration in days"
  value       = var.loki_retention_days
}

# Monitoring resource quotas output
output "monitoring_resource_quotas" {
  description = "Resource quotas configured for monitoring namespace"
  value = {
    cpu_requests    = kubernetes_resource_quota.monitoring.spec[0].hard["requests.cpu"]
    memory_requests = kubernetes_resource_quota.monitoring.spec[0].hard["requests.memory"]
    cpu_limits      = kubernetes_resource_quota.monitoring.spec[0].hard["limits.cpu"]
    memory_limits   = kubernetes_resource_quota.monitoring.spec[0].hard["limits.memory"]
  }
}

# Metrics collection interval output
output "metrics_collection_interval" {
  description = "Configured interval for metrics collection in seconds"
  value       = var.metrics_collection_interval
}