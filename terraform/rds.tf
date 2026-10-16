
resource "aws_db_subnet_group" "cine_db" {
  name = "${var.project_name}-${var.environment}-db-subnets"

  subnet_ids = [
    aws_subnet.private_1.id,
    aws_subnet.private_2.id
  ]

  tags = {
    Name        = "${var.project_name}-${var.environment}-db-subnets"
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_db_instance" "cine_mysql" {
  identifier        = "${var.project_name}-${var.environment}-mysql"
  engine            = "mysql"
  engine_version    = "8.4.11"
  instance_class    = "db.t4g.micro"
  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_name                     = "cine_dvps"
  username                    = "cine_admin"
  manage_master_user_password = true

  port                   = 3306
  db_subnet_group_name   = aws_db_subnet_group.cine_db.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period = 1
  skip_final_snapshot     = true
  deletion_protection     = false

  tags = {
    Name        = "${var.project_name}-${var.environment}-mysql"
    Project     = var.project_name
    Environment = var.environment
  }
}
