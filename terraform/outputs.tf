
output "ec2_public_ip" {
  description = "IP publica del servidor Cine"
  value       = aws_instance.cine_ec2.public_ip
}

output "rds_endpoint" {
  description = "Direccion de MySQL en AWS"
  value       = aws_db_instance.cine_mysql.address
}

output "redis_endpoint" {
  description = "Direccion de Redis en AWS"
  value       = aws_elasticache_replication_group.cine_redis.primary_endpoint_address
}

output "ecr_cine_url" {
  description = "Repositorio Docker de Cine"
  value       = aws_ecr_repository.cine_api.repository_url
}

output "ecr_cache_url" {
  description = "Repositorio Docker de Cache"
  value       = aws_ecr_repository.cache_service.repository_url
}

output "ec2_instance_id" {
  description = "Identificador del servidor Cine"
  value       = aws_instance.cine_ec2.id
}

output "rds_secret_arn" {
  description = "Identificador del secreto de MySQL"
  value       = aws_db_instance.cine_mysql.master_user_secret[0].secret_arn
}
