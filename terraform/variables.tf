variable "aws_region" {
  description = "Region de AWS donde se desplegara el proyecto"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Nombre del proyecto"
  type        = string
  default     = "cine-dvps"
}

variable "environment" {
  description = "Ambiente de despliegue"
  type        = string
  default     = "dev"
}