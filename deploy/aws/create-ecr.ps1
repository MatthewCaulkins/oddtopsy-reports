$ErrorActionPreference = "Stop"

$Region = "us-east-1"
$Repository = "oddtopsy-reports"

Write-Host "Creating ECR repository..."

aws ecr describe-repositories `
  --repository-names $Repository `
  --region $Region 2>$null

if ($LASTEXITCODE -ne 0) {
    aws ecr create-repository `
      --repository-name $Repository `
      --image-scanning-configuration scanOnPush=true `
      --region $Region
}

Write-Host "ECR repository ready."