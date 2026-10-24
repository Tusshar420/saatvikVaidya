#!/usr/bin/env bash
# Makes the upload package for Hostinger: a clean folder and a ZIP holding
# exactly the files the server needs to install, build and run the site.
#
#   scripts/package_for_hostinger.sh                 # package the saved version (HEAD)
#   scripts/package_for_hostinger.sh --out ~/Desktop # put the ZIP somewhere else
#   scripts/package_for_hostinger.sh --ref dev       # package another branch or commit
#   scripts/package_for_hostinger.sh --verify        # also install and build the ZIP
#                                                    # in a temporary folder
#
# It only reads the project and writes into the output folder (default
# dist/hostinger/, git-ignored). It never uploads anything or contacts a
# server. Steps for the owner: docs/TEST_DEPLOY_STEPS.md.
#
# Why it is safe:
# - Files come from `git archive`, so only committed files can be packed.
#   .env.local, storage/, node_modules/, .next/ and local databases are
#   git-ignored and can never get in. Unsaved edits are not packed either.
# - Development-only files are removed (list below).
# - Safety checks stop the script if a secrets file, a database dump, uploads
#   or any secret value from .env.local is found in the package.

set -euo pipefail

NAME="saatvik-vaidya-hostinger"
REF="HEAD"
OUT_DIR=""
VERIFY=0

usage() {
  sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --out) OUT_DIR="${2:?--out needs a folder}"; shift 2 ;;
    --ref) REF="${2:?--ref needs a branch or commit}"; shift 2 ;;
    --verify) VERIFY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
OUT_DIR="${OUT_DIR:-$ROOT/dist/hostinger}"
mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"
PKG_DIR="$OUT_DIR/$NAME"
ZIP="$OUT_DIR/$NAME.zip"
LIST="$OUT_DIR/$NAME.files.txt"

fail() { echo "STOPPED: $*" >&2; exit 1; }

command -v git >/dev/null || fail "git is not installed."
command -v zip >/dev/null || fail "zip is not installed."
git rev-parse --verify --quiet "$REF^{commit}" >/dev/null || fail "'$REF' is not a branch or commit here."

COMMIT="$(git rev-parse --short "$REF")"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "Packaging $REF (commit $COMMIT, current branch $BRANCH)"

if [ "$REF" = "HEAD" ] && [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "WARNING: some files have unsaved (uncommitted) changes. They are NOT in"
  echo "         the package; only the last commit is. Commit them first if needed."
fi

# Development-only files: tests and their settings, linters, notes for
# developers and assistants. The site does not need them to install, build
# or run. tests/ and the test settings files go together: vitest.config.ts
# and the *.test.ts files import from tests/, and the build type-checks every
# .ts file it finds, so leaving one without the other breaks the build.
EXCLUDE=(
  docs
  tests
  .claude
  .github
  vitest.config.ts
  playwright.config.ts
  playwright.manual.config.ts
  scripts/db-test-prepare.ts
  scripts/package_for_hostinger.sh
  eslint.config.mjs
  .prettierrc.json
  .prettierignore
  .gitignore
  .gitattributes
  AGENTS.md
  CLAUDE.md
  README.MD
  README.md
)

# Start clean. Only this script's own folder and files are removed.
rm -rf "$PKG_DIR"
rm -f "$ZIP" "$LIST"
mkdir -p "$PKG_DIR"

git archive --format=tar "$REF" | tar -x -C "$PKG_DIR"

for path in "${EXCLUDE[@]}"; do
  rm -rf "${PKG_DIR:?}/$path"
done
# Unit tests sit next to the code they test.
find "$PKG_DIR/src" -type f \( -name '*.test.ts' -o -name '*.test.tsx' \) -delete

# --- Safety checks ---------------------------------------------------------

problems=""
add_problem() { problems="$problems"$'\n'"  - $1"; }

# Files and folders that must never be uploaded.
bad_paths="$(cd "$PKG_DIR" && find . \
  \( -name node_modules -o -name .next -o -name .git \
     -o -path ./storage -o -path ./src/generated -o -name test-results \
     -o -name playwright-report -o -path ./coverage -o -path ./tests \) -prune -print \
  -o -type f \( \( -name '.env*' ! -name '.env.example' \) \
     -o -name '*.pem' -o -name '*.key' -o -name '*.p12' -o -name 'id_rsa*' \
     -o -name '*.sqlite' -o -name '*.sqlite3' -o -name '*.db' -o -name '*.dump' \
     -o -name '*.sql.gz' -o -name '*.test.ts' -o -name '*.test.tsx' \
     -o -name '*.tsbuildinfo' -o -name '.DS_Store' \) -print)"
[ -z "$bad_paths" ] || add_problem "files that must not be uploaded: $(echo $bad_paths)"

# Database dumps: the only .sql files allowed are the table changes in
# prisma/migrations, which the server needs for `pnpm db:deploy`.
bad_sql="$(cd "$PKG_DIR" && find . -type f -name '*.sql' ! -path './prisma/migrations/*')"
[ -z "$bad_sql" ] || add_problem "database files outside prisma/migrations: $(echo $bad_sql)"

# Secret values from this computer's .env.local must not appear anywhere.
# The values themselves are never printed.
if [ -f .env.local ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in ''|\#*) continue ;; esac
    key="${line%%=*}"
    value="${line#*=}"
    value="${value%\"}"; value="${value#\"}"
    value="${value%\'}"; value="${value#\'}"
    secret=0
    case "$key" in *SECRET*|*PASSWORD*|*TOKEN*|*KEY*) secret=1 ;; esac
    # A connection string with a password in it (scheme://user:pass@host).
    case "$value" in *://*:*@*) secret=1 ;; esac
    if [ "$secret" = 1 ] && [ "${#value}" -ge 8 ] && grep -rqF -- "$value" "$PKG_DIR"; then
      add_problem "the value of $key from .env.local appears in the package"
    fi
  done < .env.local
fi

# The files the server cannot do without.
for need in package.json pnpm-lock.yaml .npmrc next.config.ts tsconfig.json \
  postcss.config.mjs prisma.config.ts prisma/schema.prisma prisma/seed.ts \
  prisma/migrations src/app public scripts/admin-create.ts \
  scripts/seed-catalogue.ts scripts/clear-test-data.ts; do
  [ -e "$PKG_DIR/$need" ] || add_problem "missing required file: $need"
done

if [ -n "$problems" ]; then
  rm -rf "$PKG_DIR"
  fail "the package is not safe to upload:$problems"
fi

# --- Label, ZIP and file list ----------------------------------------------

cat > "$PKG_DIR/PACKAGE_INFO.txt" <<EOF
Saatvik Vaidya website: Hostinger upload package
Commit:  $(git rev-parse "$REF")
Made:    $(date '+%Y-%m-%d %H:%M %Z')
Made by: scripts/package_for_hostinger.sh

Not included (made on the server): node_modules/ (pnpm install),
.next/ (pnpm build), src/generated/ (made by pnpm install).
Settings are not included: create .env.local on the server, see
.env.example for the list of names.
EOF

(cd "$PKG_DIR" && find . -type f | sed 's|^\./||' | LC_ALL=C sort > "$LIST")
# -X leaves out macOS extra attributes; files sit at the top of the ZIP, so
# package.json is in the app's main folder after unpacking.
(cd "$PKG_DIR" && zip -qrX "$ZIP" .)

file_count="$(wc -l < "$LIST" | tr -d ' ')"
zip_size="$(du -h "$ZIP" | cut -f1 | tr -d ' ')"

echo
echo "Done. Nothing was uploaded."
echo "  ZIP to upload: $ZIP ($zip_size, $file_count files)"
echo "  Same files as a folder: $PKG_DIR"
echo "  List of every file: $LIST"
echo
echo "Top-level contents:"
(cd "$PKG_DIR" && for entry in $(ls -A | LC_ALL=C sort); do
  if [ -d "$entry" ]; then
    printf '  %-22s folder, %s files\n' "$entry/" "$(find "$entry" -type f | wc -l | tr -d ' ')"
  else
    printf '  %s\n' "$entry"
  fi
done)

# --- Optional: prove the ZIP installs and builds on its own -----------------

if [ "$VERIFY" = 1 ]; then
  command -v pnpm >/dev/null || fail "--verify needs pnpm."
  command -v unzip >/dev/null || fail "--verify needs unzip."
  CHECK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/$NAME-check.XXXXXX")"
  trap 'rm -rf "$CHECK_DIR"' EXIT
  echo
  echo "Checking the ZIP in a temporary folder (deleted afterwards): $CHECK_DIR"
  unzip -q "$ZIP" -d "$CHECK_DIR/app"
  cd "$CHECK_DIR/app"

  # Server-like settings with made-up values. The database address is
  # deliberately unreachable: the build must not need a database, because on
  # Hostinger it runs before `pnpm db:deploy` creates the tables.
  export DATABASE_URL="mysql://package_check:package_check@127.0.0.1:1/package_check_test"
  export BETTER_AUTH_URL="https://test.example.com"
  export BETTER_AUTH_SECRET="package-check-only-$(date +%s)-not-a-real-secret"
  export STORAGE_DIR="$CHECK_DIR/uploads"
  export PAYMENT_PROVIDER="manual"
  export SHIPPING_PROVIDER="test"
  export STAGING_ACCESS_USER="team"
  export STAGING_ACCESS_PASSWORD="package-check-only"
  export SHOW_DESIGN_PAGE="false"
  export DEV_SHOW_OTP="false"
  export APP_VERSION="package-check-$COMMIT"
  unset TEST_DATABASE_URL TEST_PAYMENTS_IN_LOCAL_BUILD TEST_SHIPPING_IN_LOCAL_BUILD \
    ADMIN_EMAIL ADMIN_PASSWORD ADMIN_NAME

  echo "1/2 pnpm install --frozen-lockfile --prod=false"
  pnpm install --frozen-lockfile --prod=false --reporter=silent
  echo "2/2 pnpm build"
  pnpm build
  echo
  echo "Check passed: the ZIP installs and builds on its own, without a database."
fi
