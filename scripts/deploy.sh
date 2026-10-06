#!/usr/bin/env bash
# Deploys the latest deploy/ims commit to the VPS.
#
# CI runs it over SSH from .github/workflows/deploy.yml (`ssh ... bash -s < scripts/deploy.sh`).
# It can also be run by hand on the VPS:  bash /opt/ims/scripts/deploy.sh
#
# Database migrations are intentionally NOT run here. Run them by hand when a
# change needs them:  docker compose --profile maintenance run --rm migrate
set -euo pipefail

APP_DIR=/opt/ims
BRANCH=deploy/ims
SERVICE=app
CONTAINER=ims-prod-app-1
IMAGE=ims-prod-app
HEALTH_TIMEOUT=180 # seconds; healthcheck has start_period 30s, interval 30s, retries 3

log() { printf '\n==> %s\n' "$*"; }

wait_for_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT)) status
  while ((SECONDS < deadline)); do
    status=$(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo missing)
    case "$status" in
      healthy) return 0 ;;
      unhealthy) return 1 ;;
    esac
    sleep 5
  done
  return 1
}

# Called when the freshly built container never reports healthy.
#   $1 = short commit hash that was running before this deploy
# The image of that commit is still available as $IMAGE:previous.
on_unhealthy() {
  local previous_commit=$1

  echo "New container is not healthy. Last 50 log lines:" >&2
  docker compose logs --tail=50 "$SERVICE" >&2 || true

  # TODO(you): decide what a failed deploy should do. See the options in chat.
  echo "Leaving the new container in place. Previous commit was $previous_commit." >&2
}

main() {
  cd "$APP_DIR"

  # Stop a manual run and a CI run from deploying at the same time. Locking the
  # app directory itself (opened read-only) works for any user that can deploy,
  # unlike a lock file in /tmp, which belongs to whichever user created it first.
  exec 9<"$APP_DIR"
  flock -n 9 || { echo "Another deploy is already running." >&2; exit 1; }

  if [[ -n $(git status --porcelain --untracked-files=no) ]]; then
    echo "Refusing to deploy: tracked files in $APP_DIR have local edits:" >&2
    git status --short --untracked-files=no >&2
    exit 1
  fi

  local previous_commit
  previous_commit=$(git rev-parse --short HEAD)

  log "Fetching origin/$BRANCH"
  git fetch --quiet origin "$BRANCH"
  git merge --ff-only --quiet "origin/$BRANCH"
  log "Deploying $(git log -1 --format='%h %s (%an)') — was $previous_commit"

  docker image tag "$IMAGE:latest" "$IMAGE:previous" 2>/dev/null || true
  docker compose up -d --build "$SERVICE"

  log "Waiting up to ${HEALTH_TIMEOUT}s for $CONTAINER to become healthy"
  if ! wait_for_healthy; then
    on_unhealthy "$previous_commit"
    exit 1
  fi

  docker image prune -f >/dev/null
  log "Deployed $(git rev-parse --short HEAD) — healthy"
}

# Wrapping everything in main() makes bash read the whole script before running
# any of it, so it is safe to pipe over SSH or to have `git merge` rewrite this file.
main "$@"
exit
