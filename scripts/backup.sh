#!/usr/bin/env bash
# Back up the database together with the files that belong to it:
# uploaded medical records, knowledge-base uploads, and generated reports.
# A backup is kept only when the database dump verifies. Safe to run from cron.
#
#   scripts/backup.sh                 # one backup now
#   BACKUP_WITH_LIBRARY=1 scripts/backup.sh   # also copy books and articles
#
# Settings (environment variables, all optional):
#   MCA_ROOT                repository path (default /var/www/medical-causation-ai)
#   BACKUP_DIR              where backups go (default /var/backups/medical-causation-ai)
#   BACKUP_KEEP_DAYS        days to keep local backups (default 14)
#   BACKUP_WITH_LIBRARY     1 = include knowledge-base books and articles
#   BACKUP_RCLONE_REMOTE    rclone destination for an off-server copy, e.g. "spaces:mca-backups"
#   BACKUP_GPG_RECIPIENT    encrypt to this GPG public key (recommended; the
#                           private key stays off the server)
#   BACKUP_PASSPHRASE_FILE  or encrypt with the passphrase in this file (chmod 600)
#   POSTGRES_CONTAINER      database container (default mca-postgres)
#
# Backups hold patient records. Without one of the two encryption settings
# they stay on this server only and are never copied off it.
set -euo pipefail

ROOT="${MCA_ROOT:-/var/www/medical-causation-ai}"
DEST="${BACKUP_DIR:-/var/backups/medical-causation-ai}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
CONTAINER="${POSTGRES_CONTAINER:-mca-postgres}"

cd "$ROOT"
if [[ ! -f .env ]]; then
  echo "No .env in $ROOT. Set MCA_ROOT to the repository path."
  exit 1
fi

# Read single values from .env without loading the rest of it.
env_value() {
  local line
  line="$(grep -E "^$1=" .env | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%$'\r'}"
  line="${line%\"}"
  line="${line#\"}"
  printf '%s' "$line"
}

DB_USER="$(env_value POSTGRES_USER)"
DB_NAME="$(env_value POSTGRES_DB)"
RECORDS="$(env_value CASE_RECORDS_PATH)"
EWI_DOCUMENTS="$(env_value EWI_DOCUMENTS_PATH)"
LIBRARY="$(env_value KNOWLEDGE_BASE_PATH)"
RECORDS="${RECORDS:-./data/case-records}"
EWI_DOCUMENTS="${EWI_DOCUMENTS:-./data/ewi-documents}"
LIBRARY="${LIBRARY:-./knowledge-base}"
if [[ -z "$DB_USER" || -z "$DB_NAME" ]]; then
  echo "POSTGRES_USER and POSTGRES_DB must be set in .env."
  exit 1
fi

umask 077
mkdir -p "$DEST"
chmod 700 "$DEST"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
work="$DEST/$stamp.partial"
final="$DEST/$stamp"
container_dump="/tmp/mca-backup-$stamp.dump"

# Container paths must reach docker unchanged (Git Bash on Windows would
# otherwise rewrite /tmp/... into a Windows path).
in_db() { MSYS_NO_PATHCONV=1 docker exec "$CONTAINER" "$@"; }

cleanup() {
  in_db rm -f "$container_dump" >/dev/null 2>&1 || true
  if [[ -d "$work" ]]; then
    rm -rf "$work"
    echo "Backup failed. Nothing was kept for $stamp."
  fi
}
trap cleanup EXIT

mkdir -p "$work"

# 1. Database. pg_dump runs inside the container, so the host needs no
#    PostgreSQL client. The dump is checked before it is kept.
echo "Dumping database $DB_NAME..."
in_db pg_dump -U "$DB_USER" -d "$DB_NAME" \
  --format=custom --compress=6 --file="$container_dump"
in_db pg_restore --list "$container_dump" >/dev/null
in_db cat "$container_dump" > "$work/database.dump"
expected="$(in_db sha256sum "$container_dump" | cut -d' ' -f1)"
copied="$(sha256sum "$work/database.dump" | cut -d' ' -f1)"
if [[ "$expected" != "$copied" ]]; then
  echo "The copied database dump does not match the original."
  exit 1
fi

# 2. Files that the database refers to. Paths are stored relative to the
#    repository so the archive restores into any checkout.
relative() {
  local path="${1#./}"
  path="${path#"$ROOT"/}"
  printf '%s' "$path"
}
paths=()
for candidate in \
  "$(relative "$RECORDS")" \
  "$(relative "$EWI_DOCUMENTS")" \
  "$(relative "$LIBRARY")/uploads" \
  "$(relative "$LIBRARY")/ewi/reports"; do
  [[ -e "$candidate" ]] && paths+=("$candidate")
done
if [[ "${BACKUP_WITH_LIBRARY:-0}" == "1" ]]; then
  for candidate in "$(relative "$LIBRARY")/books" "$(relative "$LIBRARY")/articles"; do
    [[ -e "$candidate" ]] && paths+=("$candidate")
  done
fi
if [[ ${#paths[@]} -gt 0 ]]; then
  echo "Archiving files: ${paths[*]}"
  tar -czf "$work/files.tar.gz" "${paths[@]}"
  tar -tzf "$work/files.tar.gz" >/dev/null
else
  echo "No file folders found yet; database only."
fi

# 3. Encryption at rest. Plain files are removed once encrypted.
encrypted=0
encrypt() {
  local file="$1"
  if [[ -n "${BACKUP_GPG_RECIPIENT:-}" ]]; then
    gpg --batch --yes --trust-model always --encrypt \
      --recipient "$BACKUP_GPG_RECIPIENT" --output "$file.gpg" "$file"
  else
    gpg --batch --yes --symmetric --cipher-algo AES256 \
      --pinentry-mode loopback --passphrase-file "$BACKUP_PASSPHRASE_FILE" \
      --output "$file.gpg" "$file"
  fi
  rm -f "$file"
}
if [[ -n "${BACKUP_GPG_RECIPIENT:-}" || -n "${BACKUP_PASSPHRASE_FILE:-}" ]]; then
  if ! command -v gpg >/dev/null 2>&1; then
    echo "Encryption is configured but gpg is not installed (apt install gnupg)."
    exit 1
  fi
  for file in "$work"/database.dump "$work"/files.tar.gz; do
    [[ -f "$file" ]] && encrypt "$file"
  done
  encrypted=1
  echo "Backup encrypted."
else
  echo "Warning: backup is NOT encrypted. Set BACKUP_GPG_RECIPIENT or BACKUP_PASSPHRASE_FILE."
fi

(cd "$work" && sha256sum ./* > SHA256SUMS)
mv "$work" "$final"
echo "Backup written to $final"
du -sh "$final" | cut -f1 | sed 's/^/Size: /'

# 4. Optional off-server copy. A backup on the same server does not survive
#    losing the server. Only encrypted backups leave it.
if [[ -n "${BACKUP_RCLONE_REMOTE:-}" ]]; then
  if [[ "$encrypted" != "1" ]]; then
    echo "Warning: not copying an unencrypted backup off the server. Configure encryption first."
  elif command -v rclone >/dev/null 2>&1; then
    rclone copy "$final" "$BACKUP_RCLONE_REMOTE/$stamp"
    echo "Copied to $BACKUP_RCLONE_REMOTE/$stamp"
  else
    echo "Warning: BACKUP_RCLONE_REMOTE is set but rclone is not installed."
  fi
fi

# 5. Remove local backups older than BACKUP_KEEP_DAYS. Only folders this
#    script created (named like 20261009T023000Z) are considered.
find "$DEST" -mindepth 1 -maxdepth 1 -type d -name '20[0-9][0-9][0-1][0-9][0-3][0-9]T[0-9][0-9][0-9][0-9][0-9][0-9]Z' \
  -mtime +"$KEEP_DAYS" -print -exec rm -rf {} + | sed 's/^/Removed old backup: /'
