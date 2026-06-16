terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  required_version = ">= 1.3.0"
}

provider "aws" {
  region = var.aws_region
}

# ── Lightsail instance ────────────────────────────────────────────────────────

resource "aws_lightsail_instance" "app" {
  name              = var.instance_name
  availability_zone = var.availability_zone
  blueprint_id      = "amazon_linux_2023"
  bundle_id         = var.bundle_id
  key_pair_name     = var.key_pair_name

  tags = {
    Project     = "family-app"
    Environment = "prod"
    ManagedBy   = "terraform"
  }
}

# ── Static IP ─────────────────────────────────────────────────────────────────

resource "aws_lightsail_static_ip" "app" {
  name = "${var.instance_name}-static-ip"
}

resource "aws_lightsail_static_ip_attachment" "app" {
  static_ip_name = aws_lightsail_static_ip.app.name
  instance_name  = aws_lightsail_instance.app.name
}

# ── Firewall rules ────────────────────────────────────────────────────────────

resource "aws_lightsail_instance_public_ports" "app" {
  instance_name = aws_lightsail_instance.app.name

  # SSH
  port_info {
    protocol  = "tcp"
    from_port = 22
    to_port   = 22
  }

  # HTTP
  port_info {
    protocol  = "tcp"
    from_port = 80
    to_port   = 80
  }

  # HTTPS
  port_info {
    protocol  = "tcp"
    from_port = 443
    to_port   = 443
  }

  depends_on = [aws_lightsail_instance.app]
}

# ── Outputs ───────────────────────────────────────────────────────────────────

output "lightsail_static_ip" {
  description = "Public static IP address attached to the Lightsail instance."
  value       = aws_lightsail_static_ip.app.ip_address
}
