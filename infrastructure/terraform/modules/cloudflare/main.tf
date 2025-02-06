# Cloudflare provider configuration
# Provider version: ~> 4.0
terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

# Main Cloudflare zone configuration
resource "cloudflare_zone" "main" {
  account_id = var.cloudflare_account_id
  zone       = var.domain_name
  plan       = "enterprise"

  settings {
    ssl                      = var.ssl_mode
    min_tls_version         = var.min_tls_version
    security_level          = var.security_level
    always_use_https        = true
    automatic_https_rewrites = true
    opportunistic_encryption = true
    tls_1_3                 = true
    zero_rtt                = true
    websockets              = true
    browser_cache_ttl       = var.browser_cache_ttl
    challenge_ttl           = 2700
    privacy_pass            = true
    brotli                  = true
    early_hints            = true
    http3                  = true
    cname_flattening       = "flatten_all"
    max_upload             = 500
  }

  tags = var.common_tags
}

# WAF configuration with advanced security rules
resource "cloudflare_waf_package" "main" {
  zone_id = cloudflare_zone.main.id
  
  sensitivity = "high"
  action_mode = "simulate"
}

resource "cloudflare_waf_rule" "rate_limiting" {
  zone_id = cloudflare_zone.main.id
  
  description = "Global rate limiting rule"
  expression  = "http.request.uri.path matches \".*\""
  action      = "block"
  
  rate_limit {
    characteristics = ["ip.src"]
    period          = var.waf_rate_limit_period
    threshold       = var.waf_rate_limit_requests
    mitigation_timeout = 300
  }
}

# Edge function deployment
resource "cloudflare_worker_script" "main" {
  name    = var.edge_function_name
  content = file("${path.module}/scripts/edge-function.js")

  plain_text_binding {
    name = "ENV"
    text = var.environment
  }

  kv_namespace_binding {
    name          = "CONFIG"
    namespace_id  = var.kv_namespace_id
  }

  usage_model         = "bundled"
  compatibility_date  = "2023-01-01"

  tags = var.common_tags
}

# Cache optimization rules for static assets
resource "cloudflare_page_rule" "static_assets" {
  zone_id  = cloudflare_zone.main.id
  target   = "*.${var.domain_name}/static/*"
  priority = 1

  actions {
    cache_level            = "cache_everything"
    edge_cache_ttl        = var.static_asset_cache_ttl
    browser_cache_ttl     = var.browser_cache_ttl
    cache_by_device_type  = true
    cache_deception_armor = true
    cache_on_cookie       = "none"
    bypass_cache_on_cookie = false
    explicit_cache_control = true
    origin_error_page_pass_thru = false
    sort_query_string_for_cache = true
  }
}

# Security headers configuration
resource "cloudflare_zone_settings_override" "security_headers" {
  zone_id = cloudflare_zone.main.id

  settings {
    security_header {
      enabled = true
      include_subdomains = true
      max_age = 31536000
      nosniff = true
      preload = true
    }
  }
}

# Custom error pages
resource "cloudflare_custom_pages" "error_pages" {
  zone_id = cloudflare_zone.main.id
  
  for_each = {
    "500" = "server_error"
    "1000" = "waf_block"
    "1001" = "rate_limit"
  }

  type    = each.value
  url     = "https://${var.domain_name}/error/${each.key}.html"
  state   = "customized"
}

# Firewall rules for additional security
resource "cloudflare_firewall_rule" "security_rules" {
  for_each = {
    "block_bad_bots" = "(http.user_agent contains \"bot\" and not cf.client.bot)"
    "country_block"  = "ip.geoip.country in {\"NK\" \"IR\" \"CU\"}"
  }

  zone_id     = cloudflare_zone.main.id
  description = each.key
  expression  = each.value
  action      = "block"
  priority    = 1
}

# Outputs for use in other modules
output "zone_id" {
  value       = cloudflare_zone.main.id
  description = "The Cloudflare Zone ID"
}

output "edge_function_route" {
  value       = "${var.domain_name}/*"
  description = "The edge function route pattern"
}