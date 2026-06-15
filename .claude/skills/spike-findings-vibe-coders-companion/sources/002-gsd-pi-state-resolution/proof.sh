#!/usr/bin/env bash
# Spike 002: prove VCCA can replicate gsd-pi's .gsd -> ~/.gsd/projects/<hash>/ resolution.
#
# gsd-pi algorithm (src/resources/extensions/gsd/repo-identity.ts):
#   repoIdentity(basePath):
#     - GSD_PROJECT_ID env wins outright
#     - else remoteUrl = `git config --get remote.origin.url`.trim()
#         -> sha256(remoteUrl).hex[:12]
#     - else local: sha256("\n" + gitRoot).hex[:12]
#   externalProjectsRoot = (GSD_STATE_DIR || (GSD_HOME || ~/.gsd)) + "/projects"
#   stateDir = externalProjectsRoot + "/" + hash
set -euo pipefail

# sha256[:12] via node (gsd-pi's exact createHash path) vs openssl (VCCA-equivalent)
hash_node() { node -e 'const c=require("crypto");process.stdout.write(c.createHash("sha256").update(process.argv[1]).digest("hex").slice(0,12))' "$1"; }
hash_indep() { printf '%s' "$1" | openssl dgst -sha256 | awk '{print $NF}' | cut -c1-12; }

check() {
  local label="$1" input="$2"
  local n i; n="$(hash_node "$input")"; i="$(hash_indep "$input")"
  printf "%-26s node=%s  indep=%s  %s\n" "$label" "$n" "$i" \
    "$([ "$n" = "$i" ] && echo MATCH || echo MISMATCH)"
}

echo "=== identity hash replication (node == independent tool) ==="
check "remote: github https"   "https://github.com/open-gsd/gsd-pi.git"
check "remote: github ssh"     "git@github.com:open-gsd/gsd-pi.git"
check "local: gitRoot (\\n+root)" $'\n/home/dave/repos/demo-project'

echo ""
echo "=== external state-dir resolution (precedence) ==="
URL="https://github.com/open-gsd/gsd-pi.git"
HASH="$(hash_node "$URL")"
echo "hash(remote)            = $HASH"
echo "default  (~/.gsd)       = $HOME/.gsd/projects/$HASH"
echo "GSD_HOME=/opt/gsd       = /opt/gsd/projects/$HASH"
echo "GSD_STATE_DIR=/data/gsd = /data/gsd/projects/$HASH   (GSD_STATE_DIR wins)"
echo "GSD_PROJECT_ID=fixed123 = <projectsRoot>/fixed123     (env id wins outright)"
