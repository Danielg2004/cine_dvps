
resource "aws_iam_role_policy" "cine_rds_secret_read" {
  name = "${var.project_name}-${var.environment}-rds-secret-read"
  role = aws_iam_role.cine_ec2.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_db_instance.cine_mysql.master_user_secret[0].secret_arn
      }
    ]
  })
}
