# Backend configuration for HotGigs Terraform state management
# Provider version: hashicorp/terraform ~> 1.0

terraform {
  backend "s3" {
    # S3 bucket configuration for state storage
    bucket = "hotgigs-terraform-state"
    region = "us-east-1"
    
    # Dynamic state file path based on project and environment
    key = "${var.project_name}/${var.environment}/terraform.tfstate"
    
    # Enable server-side encryption for state files
    encrypt = true
    
    # DynamoDB table for state locking
    dynamodb_table = "hotgigs-terraform-locks"
    
    # Workspace configuration for multi-environment support
    workspace_key_prefix = "workspaces"
    
    # Additional security configurations
    force_path_style = false
    
    # Ensure minimum TLS version for secure transmission
    min_tls_version = "TLS1_2"
    
    # Enable versioning for state file history
    versioning = true
    
    # Enable access logging for audit trail
    access_logging = true
    
    # Enable server-side encryption with AWS managed keys
    server_side_encryption_configuration {
      rule {
        apply_server_side_encryption_by_default {
          sse_algorithm = "AES256"
        }
      }
    }
  }
}