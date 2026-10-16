
resource "aws_elasticache_subnet_group" "cine_redis" {
  name = "${var.project_name}-${var.environment}-redis-subnets"

  subnet_ids = [
    aws_subnet.private_1.id,
    aws_subnet.private_2.id
  ]

  tags = {
    Name        = "${var.project_name}-${var.environment}-redis-subnets"
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_elasticache_replication_group" "cine_redis" {
  replication_group_id = "${var.project_name}-${var.environment}-redis"
  description          = "Cache Redis para Cine DevOps"

  engine             = "redis"
  engine_version     = "7.1"
  node_type          = "cache.t4g.micro"
  num_cache_clusters = 1
  port               = 6379

  subnet_group_name  = aws_elasticache_subnet_group.cine_redis.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  transit_encryption_mode    = "required"

  automatic_failover_enabled = false
  multi_az_enabled           = false
  apply_immediately          = true

  tags = {
    Name        = "${var.project_name}-${var.environment}-redis"
    Project     = var.project_name
    Environment = var.environment
  }
}
