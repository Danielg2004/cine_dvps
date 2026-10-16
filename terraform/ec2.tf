data "aws_ssm_parameter" "amazon_linux" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

resource "aws_iam_role" "cine_ec2" {
  name = "${var.project_name}-${var.environment}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.cine_ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "ecr" {
  role       = aws_iam_role.cine_ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_instance_profile" "cine_ec2" {
  name = "${var.project_name}-${var.environment}-ec2-profile"
  role = aws_iam_role.cine_ec2.name
}

resource "aws_instance" "cine_ec2" {
  ami                         = data.aws_ssm_parameter.amazon_linux.value
  instance_type               = "t3.small"
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.ec2.id]
  iam_instance_profile        = aws_iam_instance_profile.cine_ec2.name
  associate_public_ip_address = true

  metadata_options {
    http_tokens = "required"
  }

  root_block_device {
    volume_size           = 20
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  user_data = templatefile("${path.module}/user_data.sh.tpl", {
    aws_region     = var.aws_region
    compose_b64    = base64encode(file("${path.module}/../docker-compose.aws.yml"))
    prepare_b64    = base64encode(file("${path.module}/../prepare-ec2.sh"))
    rds_secret_arn = aws_db_instance.cine_mysql.master_user_secret[0].secret_arn
    db_host        = aws_db_instance.cine_mysql.address
    redis_endpoint = aws_elasticache_replication_group.cine_redis.primary_endpoint_address
    ecr_cine_url   = aws_ecr_repository.cine_api.repository_url
    ecr_cache_url  = aws_ecr_repository.cache_service.repository_url
  })

  # iam_instance_profile no espera a que las politicas del rol esten asociadas.
  depends_on = [
    aws_iam_role_policy_attachment.ssm,
    aws_iam_role_policy_attachment.ecr,
    aws_iam_role_policy.cine_rds_secret_read,
  ]

  tags = {
    Name        = "${var.project_name}-${var.environment}-ec2"
    Project     = var.project_name
    Environment = var.environment
  }
}
