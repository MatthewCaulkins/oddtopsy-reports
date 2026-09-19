param(
    [string]$Tag = "latest"
)

$ErrorActionPreference = "Stop"

$Region = "us-east-1"
$Repository = "oddtopsy-reports"

$AccountId = aws sts get-caller-identity `
    --query Account `
    --output text

if ($LASTEXITCODE -ne 0) {
    throw "Unable to determine AWS account ID."
}

$Registry = "$AccountId.dkr.ecr.$Region.amazonaws.com"
$Image = "$Registry/$Repository`:$Tag"

Write-Host ""
Write-Host "Logging into ECR..."

aws ecr get-login-password --region $Region |
    docker login `
        --username AWS `
        --password-stdin $Registry

if ($LASTEXITCODE -ne 0) {
    throw "ECR login failed."
}

Write-Host ""
Write-Host "Building $Image..."

docker build `
    --platform linux/amd64 `
    -t $Image `
    .

if ($LASTEXITCODE -ne 0) {
    throw "Docker build failed."
}

Write-Host ""
Write-Host "Pushing $Image..."

docker push $Image

if ($LASTEXITCODE -ne 0) {
    throw "Docker push failed."
}

Write-Host ""
Write-Host "Published:"
Write-Host $Image


# Write-Host ""
# Write-Host "Starting ECS deployment..."

# aws ecs update-service `
#     --cluster oddtopsy-reports `
#     --service oddtopsy-reports `
#     --force-new-deployment `
#     --region $Region