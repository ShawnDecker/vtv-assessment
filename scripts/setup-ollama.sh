#!/bin/bash
# ============================================================
# VTV Assessment — Ollama Local AI Setup
# Run this once on any machine to set up local AI models.
#
# Usage:
#   chmod +x scripts/setup-ollama.sh
#   ./scripts/setup-ollama.sh
#
# Requirements:
#   - Ollama installed (https://ollama.ai)
#   - 8GB+ RAM (16GB recommended)
# ============================================================

set -e

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║   VTV Assessment — Ollama Local AI Setup     ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
  echo "  [ERROR] Ollama is not installed."
  echo ""
  echo "  Install it from: https://ollama.ai"
  echo ""
  echo "  Quick install:"
  echo "    macOS:   brew install ollama"
  echo "    Linux:   curl -fsSL https://ollama.com/install.sh | sh"
  echo "    Windows: Download from https://ollama.ai/download"
  echo ""
  exit 1
fi

echo "  [OK] Ollama is installed: $(ollama --version 2>/dev/null || echo 'version unknown')"
echo ""

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
  echo "  [INFO] Starting Ollama server..."
  ollama serve &
  sleep 3
fi

echo "  [OK] Ollama server is running"
echo ""

# Detect available RAM
TOTAL_RAM_GB=0
if [[ "$OSTYPE" == "darwin"* ]]; then
  TOTAL_RAM_GB=$(( $(sysctl -n hw.memsize) / 1073741824 ))
elif [[ -f /proc/meminfo ]]; then
  TOTAL_RAM_GB=$(( $(grep MemTotal /proc/meminfo | awk '{print $2}') / 1048576 ))
fi

echo "  [INFO] Detected RAM: ${TOTAL_RAM_GB}GB"
echo ""

# Select models based on available RAM
if [ "$TOTAL_RAM_GB" -ge 32 ]; then
  echo "  [INFO] 32GB+ RAM — Pulling full model set"
  MODELS=("llama3.1:8b" "mistral:7b")
  echo "  Models: llama3.1:8b (coaching, content, devotionals)"
  echo "          mistral:7b (email drafts, summaries)"
elif [ "$TOTAL_RAM_GB" -ge 16 ]; then
  echo "  [INFO] 16GB RAM — Pulling standard model set"
  MODELS=("llama3.1:8b" "mistral:7b")
  echo "  Models: llama3.1:8b (coaching, content, devotionals)"
  echo "          mistral:7b (email drafts, summaries)"
elif [ "$TOTAL_RAM_GB" -ge 8 ]; then
  echo "  [INFO] 8GB RAM — Pulling lightweight models"
  MODELS=("phi3:mini" "mistral:7b")
  echo "  Models: phi3:mini (fast, all tasks)"
  echo "          mistral:7b (email drafts when resources allow)"
else
  echo "  [WARN] Less than 8GB RAM detected. Using smallest model only."
  MODELS=("phi3:mini")
  echo "  Model: phi3:mini (3.8B parameters)"
fi

echo ""
echo "  Pulling models (this may take a few minutes on first run)..."
echo ""

for model in "${MODELS[@]}"; do
  echo "  [$model] Pulling..."
  ollama pull "$model"
  echo "  [$model] Ready"
  echo ""
done

# Show what's installed
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║              Setup Complete!                 ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""
echo "  Installed models:"
ollama list 2>/dev/null | head -10
echo ""
echo "  To start VTV with local AI:"
echo "    npm run dev:local-ai"
echo ""
echo "  To use auto-mode (local first, cloud fallback):"
echo "    AI_PROVIDER=auto npm run dev"
echo ""

# Generate recommended .env settings based on RAM
if [ "$TOTAL_RAM_GB" -ge 16 ]; then
  cat <<ENVBLOCK
  Recommended .env settings for your system:
    AI_PROVIDER=local
    LOCAL_MODEL_COACHING=llama3.1:8b
    LOCAL_MODEL_SUMMARY=mistral:7b
    LOCAL_MODEL_EMAIL=mistral:7b
    LOCAL_MODEL_CONTENT=llama3.1:8b
    LOCAL_MODEL_DEVOTIONAL=llama3.1:8b
ENVBLOCK
elif [ "$TOTAL_RAM_GB" -ge 8 ]; then
  cat <<ENVBLOCK
  Recommended .env settings for your system:
    AI_PROVIDER=local
    LOCAL_MODEL_COACHING=phi3:mini
    LOCAL_MODEL_SUMMARY=phi3:mini
    LOCAL_MODEL_EMAIL=mistral:7b
    LOCAL_MODEL_CONTENT=phi3:mini
    LOCAL_MODEL_DEVOTIONAL=phi3:mini
ENVBLOCK
else
  cat <<ENVBLOCK
  Recommended .env settings for your system:
    AI_PROVIDER=auto
    LOCAL_MODEL_COACHING=phi3:mini
    LOCAL_MODEL_SUMMARY=phi3:mini
    LOCAL_MODEL_EMAIL=phi3:mini
    LOCAL_MODEL_CONTENT=phi3:mini
    LOCAL_MODEL_DEVOTIONAL=phi3:mini
ENVBLOCK
fi

echo ""
