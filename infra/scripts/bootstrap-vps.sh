#!/usr/bin/env bash
# One-time setup for a fresh GCP VPS that will run:
#   - self-hosted Supabase (db, auth, kong) via docker-compose.yml
#   - the whiteboard backend + Caddy reverse proxy via docker-compose.prod.yml
#
# Run this AS ROOT (or via sudo) over SSH, right after creating the VM:
#   scp infra/scripts/bootstrap-vps.sh you@VPS_IP:~/
#   ssh you@VPS_IP
#   sudo bash bootstrap-vps.sh
#
# It is idempotent-ish but written for a brand-new box — review each section
# before running on a machine that already has other things on it.

set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
REPO_URL="${REPO_URL:-https://github.com/letuano5/whiteboard-fe.git}"
APP_DIR="/opt/whiteboard"

echo "==> 1. System update + unattended security upgrades"
apt-get update -y
apt-get upgrade -y
apt-get install -y unattended-upgrades fail2ban curl ca-certificates
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> 2. Create non-root deploy user"
if ! id "$DEPLOY_USER" &>/dev/null; then
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
  usermod -aG sudo "$DEPLOY_USER"
fi
mkdir -p "/home/$DEPLOY_USER/.ssh"
if [ -f /root/.ssh/authorized_keys ]; then
  cp /root/.ssh/authorized_keys "/home/$DEPLOY_USER/.ssh/authorized_keys"
fi
chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
chmod 700 "/home/$DEPLOY_USER/.ssh"
chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys" 2>/dev/null || true

echo "==> 3. fail2ban for sshd"
systemctl enable --now fail2ban

echo "==> 4. Install Docker Engine + Compose plugin"
if ! command -v docker &>/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $VERSION_CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
usermod -aG docker "$DEPLOY_USER"

echo "==> 5. Clone the repo"
mkdir -p "$APP_DIR"
chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  sudo -u "$DEPLOY_USER" git clone "$REPO_URL" "$APP_DIR"
fi

echo "==> 6. Generate a dedicated SSH keypair for GitHub Actions"
DEPLOY_KEY_PATH="/home/$DEPLOY_USER/.ssh/github_actions_deploy"
if [ ! -f "$DEPLOY_KEY_PATH" ]; then
  sudo -u "$DEPLOY_USER" ssh-keygen -t ed25519 -N "" -f "$DEPLOY_KEY_PATH" -C "github-actions-deploy"
  cat "$DEPLOY_KEY_PATH.pub" >> "/home/$DEPLOY_USER/.ssh/authorized_keys"
fi

echo ""
echo "============================================================"
echo "Done. Manual steps still required:"
echo ""
echo "1) GCP firewall (run from your machine with gcloud, or in the"
echo "   GCP Console under VPC network > Firewall):"
echo "     - allow tcp:22, tcp:80, tcp:443 only from the internet"
echo "     - remove/avoid any default-allow-all rule"
echo "     - do NOT open tcp:5432 to 0.0.0.0/0"
echo ""
echo "2) SSH hardening (only after confirming key-based login works!):"
echo "     sudo sed -i 's/^#\\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config"
echo "     sudo systemctl restart sshd"
echo ""
echo "3) Create $APP_DIR/.env (copy from .env.example) with at least:"
echo "     FRONTEND_ORIGINS=https://letuano5.github.io"
echo "     API_DOMAIN=api.<VPS_PUBLIC_IP-with-dots>.nip.io"
echo "     SUPABASE_DOMAIN=supabase.<VPS_PUBLIC_IP-with-dots>.nip.io"
echo "     GHCR_OWNER=letuano5"
echo "   plus the existing Supabase vars (POSTGRES_*, JWT_SECRET, ANON_KEY, ...)."
echo ""
echo "4) First manual start (after .env is in place):"
echo "     cd $APP_DIR"
echo "     docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
echo ""
echo "5) Add these GitHub repo secrets (Settings > Secrets and variables > Actions):"
echo "     VPS_HOST     = <VPS public IP>"
echo "     VPS_USER     = $DEPLOY_USER"
echo "     VPS_APP_DIR  = $APP_DIR"
echo "     VPS_SSH_KEY  = contents of: $DEPLOY_KEY_PATH (the PRIVATE key)"
echo ""
echo "   Print the private key to copy it:"
echo "     sudo cat $DEPLOY_KEY_PATH"
echo "============================================================"
