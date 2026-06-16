variable "aws_region" {
  description = "AWS region where Lightsail resources will be provisioned."
  type        = string
  default     = "us-east-1"
}

variable "instance_name" {
  description = "Name of the Lightsail instance."
  type        = string
  default     = "family-app-prod"
}

variable "availability_zone" {
  description = "Availability zone within the selected region."
  type        = string
  default     = "us-east-1a"
}

variable "bundle_id" {
  description = "Lightsail bundle (size) for the instance. micro_3_0 = 1 vCPU / 1 GB RAM."
  type        = string
  default     = "micro_3_0"
}

variable "key_pair_name" {
  description = "Name of a pre-existing Lightsail key pair used for SSH access."
  type        = string
}
