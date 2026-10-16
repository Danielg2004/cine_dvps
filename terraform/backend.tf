
terraform {
  backend "s3" {
    bucket       = "cine-dvps-tfstate-102798328572-us-east-2"
    key          = "cine-dvps/dev/terraform.tfstate"
    region       = "us-east-2"
    encrypt      = true
    use_lockfile = true
  }
}
