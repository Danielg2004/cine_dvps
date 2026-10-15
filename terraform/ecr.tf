resource "aws_ecr_repository" "cine_api" {
  name                 = "${var.project_name}-${var.environment}-cine-api"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-cine-api"
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_ecr_repository" "cache_service" {
  name                 = "${var.project_name}-${var.environment}-cache-service"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-cache-service"
    Project     = var.project_name
    Environment = var.environment
  }
}