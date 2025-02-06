# Monitoring Infrastructure Module for HotGigs Platform
# Implements comprehensive monitoring stack with Prometheus, Grafana, Loki and DataDog
# Version: 1.0.0

terraform {
  required_providers {
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    datadog = {
      source  = "datadog/datadog"
      version = "~> 3.0"
    }
  }
}

# Create dedicated monitoring namespace
resource "kubernetes_namespace" "monitoring" {
  metadata {
    name = var.monitoring_namespace
    labels = {
      environment = var.environment
      managed-by  = "terraform"
      component   = "monitoring"
    }
  }

  spec {
    finalizers = ["kubernetes"]
  }
}

# Configure Prometheus monitoring stack
resource "helm_release" "prometheus" {
  name       = "prometheus"
  repository = "https://prometheus-community.github.io/helm-charts"
  chart      = "kube-prometheus-stack"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  version    = "45.7.1"

  values = [
    yamlencode({
      prometheus = {
        prometheusSpec = {
          retention        = "${var.prometheus_retention_days}d"
          scrapeInterval  = "${var.metrics_collection_interval}s"
          replicaCount    = var.environment == "production" ? 2 : 1
          storageSpec = {
            volumeClaimTemplate = {
              spec = {
                storageClassName = "standard"
                resources = {
                  requests = {
                    storage = "50Gi"
                  }
                }
              }
            }
          }
          resources = {
            requests = {
              cpu    = "500m"
              memory = "2Gi"
            }
            limits = {
              cpu    = "2000m"
              memory = "4Gi"
            }
          }
        }
      }
      alertmanager = {
        enabled = true
        config = {
          global = {
            resolve_timeout = "5m"
          }
          route = {
            receiver = "pagerduty"
            group_wait      = "30s"
            group_interval  = "5m"
            repeat_interval = "4h"
          }
        }
      }
    })
  ]

  depends_on = [kubernetes_namespace.monitoring]
}

# Deploy Grafana visualization platform
resource "helm_release" "grafana" {
  name       = "grafana"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "grafana"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  version    = "6.50.7"

  values = [
    yamlencode({
      replicas = var.environment == "production" ? 2 : 1
      persistence = {
        enabled = true
        size    = "10Gi"
      }
      adminPassword = var.grafana_admin_password
      datasources = {
        "datasources.yaml" = {
          apiVersion = 1
          datasources = [
            {
              name      = "Prometheus"
              type      = "prometheus"
              url       = "http://prometheus-server"
              isDefault = true
            },
            {
              name = "Loki"
              type = "loki"
              url  = "http://loki:3100"
            }
          ]
        }
      }
      resources = {
        requests = {
          cpu    = "200m"
          memory = "256Mi"
        }
        limits = {
          cpu    = "1000m"
          memory = "1Gi"
        }
      }
    })
  ]

  depends_on = [helm_release.prometheus]
}

# Configure Loki log aggregation
resource "helm_release" "loki" {
  name       = "loki"
  repository = "https://grafana.github.io/helm-charts"
  chart      = "loki"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  version    = "4.8.0"

  values = [
    yamlencode({
      replicas = var.environment == "production" ? 3 : 1
      retention = "${var.loki_retention_days}d"
      persistence = {
        enabled = true
        size    = "50Gi"
      }
      config = {
        table_manager = {
          retention_deletes_enabled = true
          retention_period         = "${var.loki_retention_days * 24}h"
        }
      }
      resources = {
        requests = {
          cpu    = "200m"
          memory = "256Mi"
        }
        limits = {
          cpu    = "1000m"
          memory = "2Gi"
        }
      }
    })
  ]

  depends_on = [kubernetes_namespace.monitoring]
}

# Setup DataDog monitoring integration
resource "helm_release" "datadog" {
  name       = "datadog"
  repository = "https://helm.datadoghq.com"
  chart      = "datadog"
  namespace  = kubernetes_namespace.monitoring.metadata[0].name
  version    = "3.12.1"

  values = [
    yamlencode({
      datadog = {
        apiKey = var.datadog_api_key
        apm = {
          enabled = true
          portEnabled = true
        }
        logs = {
          enabled = true
          containerCollectAll = true
        }
        processAgent = {
          enabled = true
          processCollection = true
        }
        resources = {
          requests = {
            cpu    = "200m"
            memory = "256Mi"
          }
          limits = {
            cpu    = "1000m"
            memory = "1Gi"
          }
        }
      }
      clusterAgent = {
        enabled = true
        metricsProvider = {
          enabled = true
        }
      }
    })
  ]

  depends_on = [kubernetes_namespace.monitoring]
}

# Configure network policies for monitoring namespace
resource "kubernetes_network_policy" "monitoring" {
  metadata {
    name      = "monitoring-network-policy"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  spec {
    pod_selector {}
    
    ingress {
      from {
        namespace_selector {
          match_labels = {
            environment = var.environment
          }
        }
      }
      ports {
        port     = "9090"  # Prometheus
        protocol = "TCP"
      }
      ports {
        port     = "3000"  # Grafana
        protocol = "TCP"
      }
      ports {
        port     = "3100"  # Loki
        protocol = "TCP"
      }
    }

    policy_types = ["Ingress"]
  }

  depends_on = [kubernetes_namespace.monitoring]
}

# Create monitoring resource quotas
resource "kubernetes_resource_quota" "monitoring" {
  metadata {
    name      = "monitoring-quota"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  spec {
    hard = {
      "requests.cpu"    = "4"
      "requests.memory" = "8Gi"
      "limits.cpu"      = "8"
      "limits.memory"   = "16Gi"
    }
  }

  depends_on = [kubernetes_namespace.monitoring]
}