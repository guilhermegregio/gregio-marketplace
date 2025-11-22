#!/nix/store/xy4jjgw87sbgwylm5kn047d9gkbhsr9x-bash-5.2p37/bin/bash
set -o errexit
set -o nounset
set -o pipefail

export PATH="/nix/store/1q9lw4r2mbap8rsr8cja46nap6wvrw2p-bash-interactive-5.2p37/bin:/nix/store/c8jxsih8yy2rnncdmx2hyraizf689nvp-nodejs-22.14.0/bin:$PATH"

# URL do webhook Discord
DISCORD_WEBHOOK="https://discord.com/api/webhooks/1418606826433417246/tA2FTwsR5v-MWgRIyiKwJRbRHuK31X_rqggEttTNXi1-k5rIhaW8BpVdOR1SQqdzctle"

# Mensagem padrão ou a fornecida como argumento
MESSAGE="${*:-🔔 Notificação do Claude Code}"

# Script para emitir um beep de notificação
# Usado para alertar sobre ações que requerem atenção manual

# Emitir o beep usando Node.js
node -e "console.log('\007')"

# Exibir mensagem localmente
echo "$MESSAGE"

# Enviar para Discord
curl -s -X POST "$DISCORD_WEBHOOK" \
  -H "Content-Type: application/json" \
  -d "{
    \"content\": \"🤖 **Claude Code**\",
    \"embeds\": [{
      \"description\": \"$MESSAGE\",
      \"color\": 5814783,
      \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"footer\": {
        \"text\": \"$(hostname)\"
      }
    }]
  }" > /dev/null 2>&1 &
