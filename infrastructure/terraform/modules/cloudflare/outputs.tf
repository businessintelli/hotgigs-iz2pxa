# Output definitions for the Cloudflare module
# Exports essential configuration values for CDN, WAF, and edge function integrations

output "zone_id" {
  description = "The Cloudflare Zone ID for the domain"
  value       = cloudflare_zone.main.id
  sensitive   = false
}

output "zone_name" {
  description = "The domain name of the Cloudflare zone"
  value       = cloudflare_zone.main.name
  sensitive   = false
}

output "edge_function_name" {
  description = "Name of the deployed edge function"
  value       = cloudflare_worker_script.main.name
  sensitive   = false
}

output "nameservers" {
  description = "List of Cloudflare nameservers for the zone"
  value       = cloudflare_zone.main.name_servers
  sensitive   = false
}

output "security_settings" {
  description = "Security configuration settings for the zone"
  value = {
    ssl_mode         = cloudflare_zone.main.settings[0].ssl
    min_tls_version  = cloudflare_zone.main.settings[0].min_tls_version
    security_level   = cloudflare_zone.main.settings[0].security_level
  }
  sensitive = false
}