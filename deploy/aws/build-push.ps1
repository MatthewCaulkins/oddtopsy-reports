<#
.SYNOPSIS
Builds the app image and pushes it to ECR under a versioned tag.

.EXAMPLE
./deploy/aws/build-push.ps1 -Name rbac
Pushes oddtopsy-reports:20261021-rbac (today's date + name).

.EXAMPLE
./deploy/aws/build-push.ps1 -Tag 20261021-rbac-2
Pushes an exact tag.

This only builds and pushes. Deploying the image to ECS is a separate step.
#>
param(
    # Short description appended to today's date, e.g. "rbac" -> 20261021-rbac.
    [string]$Name,

    # Exact tag to use instead of date + name.
    [string]$Tag,

    # Build even if the working tree has uncommitted changes.
    [switch]$AllowDirty
)

$ErrorActionPreference = "Stop"

$Region = "us-east-1"
$Repository = "oddtopsy-reports"
$AwsProfile = "oddtopsy"

if (-not $Tag) {
    if (-not $Name) {
        throw "Pass -Name (e.g. -Name rbac -> $(Get-Date -Format yyyyMMdd)-rbac) or -Tag."
    }

    $Tag = "$(Get-Date -Format yyyyMMdd)-$Name"
}

if ($Tag -eq "latest") {
    throw "Use a versioned tag, not 'latest'."
}

if ($Tag -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$') {
    throw "Invalid image tag '$Tag'. Use letters, numbers, '.', '_' or '-'."
}

# Tie every image to a commit so it is clear what code is running.
$GitStatus = git status --porcelain

if ($GitStatus -and -not $AllowDirty) {
    throw "Uncommitted changes. Commit first, or pass -AllowDirty."
}

$Commit = (git rev-parse --short HEAD).Trim()

$AccountId = aws sts get-caller-identity `
    --profile $AwsProfile `
    --query Account `
    --output text

if ($LASTEXITCODE -ne 0) {
    throw "Unable to determine AWS account ID for profile '$AwsProfile'."
}

$Registry = "$AccountId.dkr.ecr.$Region.amazonaws.com"
$Image = "$Registry/$Repository`:$Tag"

# Never overwrite an existing tag. Only "image not found" means the tag is free;
# any other error (e.g. access denied) aborts rather than risking an overwrite.
$DescribeOutput = aws ecr describe-images `
    --profile $AwsProfile `
    --region $Region `
    --repository-name $Repository `
    --image-ids imageTag=$Tag 2>&1 | Out-String

if ($LASTEXITCODE -eq 0) {
    throw "Tag '$Tag' already exists in $Repository. Choose another -Name or -Tag."
}

if ($DescribeOutput -notmatch "ImageNotFoundException") {
    throw "Could not check whether tag '$Tag' exists: $DescribeOutput"
}

Write-Host ""
Write-Host "Logging into ECR ($AccountId, profile $AwsProfile)..."

aws ecr get-login-password --profile $AwsProfile --region $Region |
    docker login `
        --username AWS `
        --password-stdin $Registry

if ($LASTEXITCODE -ne 0) {
    throw "ECR login failed."
}

Write-Host ""
Write-Host "Building $Image from commit $Commit..."

# No provenance/SBOM attestations: with them Docker pushes an OCI image index,
# whose digest ECS Fargate failed to pull. A plain linux/amd64 manifest pulls reliably.
docker build `
    --platform linux/amd64 `
    --provenance=false `
    --sbom=false `
    --label "org.opencontainers.image.revision=$Commit" `
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
Write-Host "Commit: $Commit"
