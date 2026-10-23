#!/usr/bin/env bash
#
# Builds the app image and pushes it to ECR under a versioned tag.
#
#   deploy/aws/build-push.sh --name rbac        # -> oddtopsy-reports:20261022-rbac
#   deploy/aws/build-push.sh --tag 20261022-rbac-2
#
# Safeguards:
# - versioned tags only ('latest' is refused)
# - refuses uncommitted changes (the image must match a commit), unless --allow-dirty
# - never overwrites an existing tag; aborts if that cannot be checked
# - labels the image with its git commit
#
# This only builds and pushes. Deploying the image to ECS is a separate step.

set -euo pipefail

REGION="us-east-1"
REPOSITORY="oddtopsy-reports"
AWS_PROFILE_NAME="oddtopsy"

name=""
tag=""
allow_dirty=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) name="${2:-}"; shift 2 ;;
    --tag) tag="${2:-}"; shift 2 ;;
    --allow-dirty) allow_dirty=true; shift ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

fail() { echo "Error: $*" >&2; exit 1; }

if [[ -z "$tag" ]]; then
  [[ -n "$name" ]] || fail "Pass --name (e.g. --name rbac -> $(date +%Y%m%d)-rbac) or --tag."
  tag="$(date +%Y%m%d)-$name"
fi

[[ "$tag" != "latest" ]] || fail "Use a versioned tag, not 'latest'."
[[ "$tag" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]] || fail "Invalid image tag '$tag'. Use letters, numbers, '.', '_' or '-'."

# Tie every image to a commit so it is clear what code is running.
if [[ -n "$(git status --porcelain)" && "$allow_dirty" != true ]]; then
  fail "Uncommitted changes. Commit first, or pass --allow-dirty."
fi

commit="$(git rev-parse --short HEAD)"

aws_() { aws --profile "$AWS_PROFILE_NAME" --region "$REGION" "$@"; }

account_id="$(aws_ sts get-caller-identity --query Account --output text)" \
  || fail "Unable to determine AWS account ID for profile '$AWS_PROFILE_NAME'."

registry="$account_id.dkr.ecr.$REGION.amazonaws.com"
image="$registry/$REPOSITORY:$tag"

# Never overwrite an existing tag. Only "image not found" means the tag is free;
# any other error (e.g. access denied) aborts rather than risking an overwrite.
if describe_output="$(aws_ ecr describe-images --repository-name "$REPOSITORY" --image-ids "imageTag=$tag" 2>&1)"; then
  fail "Tag '$tag' already exists in $REPOSITORY. Choose another --name or --tag."
elif ! grep -q "ImageNotFoundException" <<<"$describe_output"; then
  fail "Could not check whether tag '$tag' exists: $describe_output"
fi

echo
echo "Logging into ECR ($account_id, profile $AWS_PROFILE_NAME)..."
aws_ ecr get-login-password | docker login --username AWS --password-stdin "$registry"

echo
echo "Building $image from commit $commit..."
# No provenance/SBOM attestations: with them Docker pushes an OCI image index,
# whose digest ECS Fargate failed to pull. A plain linux/amd64 manifest pulls reliably.
docker build \
  --platform linux/amd64 \
  --provenance=false \
  --sbom=false \
  --label "org.opencontainers.image.revision=$commit" \
  -t "$image" \
  .

echo
echo "Pushing $image..."
docker push "$image"

# Read the digest back from ECR and make sure it is a single image manifest.
read -r digest media_type < <(aws_ ecr describe-images --repository-name "$REPOSITORY" \
  --image-ids "imageTag=$tag" --query 'imageDetails[0].[imageDigest,imageManifestMediaType]' --output text)

# The AWS CLI on Windows ends lines with \r.
digest="${digest%$'\r'}"
media_type="${media_type%$'\r'}"

case "$media_type" in
  application/vnd.oci.image.manifest.v1+json | application/vnd.docker.distribution.manifest.v2+json) ;;
  *) fail "Pushed $image as '$media_type', not a single image manifest. Do not deploy it by digest." ;;
esac

echo
echo "Published: $image"
echo "Commit:    $commit"
echo "Digest:    $registry/$REPOSITORY@$digest"
echo "Use the digest form in the ECS task definition."
