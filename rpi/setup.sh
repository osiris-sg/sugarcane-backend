#!/bin/bash
# Sales Prediction Setup Script for Raspberry Pi
#
# Usage:
#   mkdir sales_prediction && cd sales_prediction
#   curl -L https://raw.githubusercontent.com/osiris-sg/sugarcane-backend/main/rpi/setup.sh > setup.sh
#   chmod +x setup.sh
#   ./setup.sh download
#   nano .env  # Set DATABASE_URL
#   ./setup.sh install
#   ./setup.sh run

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="https://raw.githubusercontent.com/osiris-sg/sugarcane-backend/main/rpi"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

download() {
    log_info "Downloading files from GitHub..."

    # Download Python script
    log_info "Downloading sales_prediction.py..."
    curl -fsSL "$BASE_URL/sales_prediction.py" -o "$SCRIPT_DIR/sales_prediction.py"
    chmod +x "$SCRIPT_DIR/sales_prediction.py"

    # Download requirements
    log_info "Downloading requirements.txt..."
    curl -fsSL "$BASE_URL/requirements.txt" -o "$SCRIPT_DIR/requirements.txt"

    # Download training script and data
    log_info "Downloading train_model.py..."
    curl -fsSL "$BASE_URL/train_model.py" -o "$SCRIPT_DIR/train_model.py"
    chmod +x "$SCRIPT_DIR/train_model.py"

    log_info "Downloading training_data.csv (10MB, may take a moment)..."
    curl -fsSL "$BASE_URL/training_data.csv" -o "$SCRIPT_DIR/training_data.csv"

    # Create .env template if not exists
    if [ ! -f "$SCRIPT_DIR/.env" ]; then
        log_info "Creating .env template..."
        cat > "$SCRIPT_DIR/.env" << 'EOF'
# Database connection string
DATABASE_URL=postgresql://user:password@host:5432/database
EOF
        log_warn "Please edit .env with your DATABASE_URL"
    fi

    log_info "Download complete!"
    echo ""
    echo "Next steps:"
    echo "  1. nano .env           # Set your DATABASE_URL"
    echo "  2. ./setup.sh install  # Install Python dependencies"
    echo "  3. ./setup.sh run      # Test the prediction"
}

install() {
    log_info "Installing dependencies..."

    # Check Python
    if ! command -v python3 &> /dev/null; then
        log_error "Python3 not found. Please install Python3."
        exit 1
    fi

    PYTHON_VERSION=$(python3 --version 2>&1)
    log_info "Found $PYTHON_VERSION"

    # Create virtual environment
    if [ ! -d "$SCRIPT_DIR/venv" ]; then
        log_info "Creating virtual environment..."
        python3 -m venv "$SCRIPT_DIR/venv"
    fi

    # Activate and install
    source "$SCRIPT_DIR/venv/bin/activate"
    log_info "Installing Python packages..."
    pip install --upgrade pip -q
    pip install -r "$SCRIPT_DIR/requirements.txt" -q

    log_info "Installation complete!"
    echo ""
    echo "Next steps:"
    echo "  ./setup.sh run      # Test the prediction"
    echo "  ./setup.sh service  # Install as systemd service"
}

train() {
    log_info "Training model from local data..."

    if [ ! -d "$SCRIPT_DIR/venv" ]; then
        log_error "Virtual environment not found. Run: ./setup.sh install"
        exit 1
    fi

    if [ ! -f "$SCRIPT_DIR/training_data.csv" ]; then
        log_error "Training data not found. Run: ./setup.sh download"
        exit 1
    fi

    source "$SCRIPT_DIR/venv/bin/activate"
    python "$SCRIPT_DIR/train_model.py"

    log_info "Training complete! Model files created."
}

run() {
    log_info "Running prediction..."

    if [ ! -f "$SCRIPT_DIR/.env" ]; then
        log_error ".env file not found. Run: nano .env"
        exit 1
    fi

    if [ ! -d "$SCRIPT_DIR/venv" ]; then
        log_error "Virtual environment not found. Run: ./setup.sh install"
        exit 1
    fi

    # Check for model files
    if [ ! -f "$SCRIPT_DIR/sales_model.joblib" ]; then
        log_warn "Model not found. Training from local data first..."
        train
    fi

    source "$SCRIPT_DIR/venv/bin/activate"
    export $(cat "$SCRIPT_DIR/.env" | grep -v '^#' | xargs)

    python "$SCRIPT_DIR/sales_prediction.py"
}

daemon() {
    log_info "Starting daemon mode (22:30 SGT daily)..."

    if [ ! -f "$SCRIPT_DIR/.env" ]; then
        log_error ".env file not found. Run: nano .env"
        exit 1
    fi

    source "$SCRIPT_DIR/venv/bin/activate"
    export $(cat "$SCRIPT_DIR/.env" | grep -v '^#' | xargs)

    python "$SCRIPT_DIR/sales_prediction.py" --daemon
}

service() {
    log_info "Installing systemd service..."

    # Create systemd timer
    sudo tee /etc/systemd/system/sales-prediction.timer > /dev/null << EOF
[Unit]
Description=Run Sales Prediction daily at 22:30 SGT

[Timer]
OnCalendar=*-*-* 22:30:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

    sudo tee /etc/systemd/system/sales-prediction.service > /dev/null << EOF
[Unit]
Description=Sales Prediction Service
After=network.target

[Service]
Type=oneshot
User=$USER
WorkingDirectory=$SCRIPT_DIR
EnvironmentFile=$SCRIPT_DIR/.env
ExecStart=$SCRIPT_DIR/venv/bin/python $SCRIPT_DIR/sales_prediction.py

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable sales-prediction.timer
    sudo systemctl start sales-prediction.timer

    log_info "Service installed!"
    echo ""
    echo "Timer status:"
    sudo systemctl list-timers | grep sales-prediction
    echo ""
    echo "Commands:"
    echo "  sudo systemctl status sales-prediction.timer  # Check timer"
    echo "  sudo journalctl -u sales-prediction -f        # View logs"
    echo "  sudo systemctl stop sales-prediction.timer    # Stop timer"
}

logs() {
    if [ -f "$SCRIPT_DIR/prediction.log" ]; then
        tail -f "$SCRIPT_DIR/prediction.log"
    else
        log_warn "No log file yet. Run: ./setup.sh run"
    fi
}

status() {
    echo "=== Sales Prediction Status ==="
    echo ""

    # Check files
    echo "Files:"
    [ -f "$SCRIPT_DIR/sales_prediction.py" ] && echo "  ✓ sales_prediction.py" || echo "  ✗ sales_prediction.py (run: ./setup.sh download)"
    [ -f "$SCRIPT_DIR/sales_model.joblib" ] && echo "  ✓ sales_model.joblib" || echo "  ✗ sales_model.joblib"
    [ -f "$SCRIPT_DIR/encoder.joblib" ] && echo "  ✓ encoder.joblib" || echo "  ✗ encoder.joblib"
    [ -f "$SCRIPT_DIR/.env" ] && echo "  ✓ .env" || echo "  ✗ .env (run: nano .env)"
    [ -d "$SCRIPT_DIR/venv" ] && echo "  ✓ venv" || echo "  ✗ venv (run: ./setup.sh install)"
    echo ""

    # Check systemd timer
    if systemctl is-active --quiet sales-prediction.timer 2>/dev/null; then
        echo "Systemd Timer: Active"
        sudo systemctl list-timers | grep sales-prediction || true
    else
        echo "Systemd Timer: Not installed (run: ./setup.sh service)"
    fi
}

usage() {
    echo "Sales Prediction Setup Script"
    echo ""
    echo "Usage: ./setup.sh <command>"
    echo ""
    echo "Commands:"
    echo "  download   Download all files from GitHub"
    echo "  install    Create venv and install dependencies"
    echo "  train      Train model from local data (training_data.csv)"
    echo "  run        Run prediction once"
    echo "  daemon     Run as daemon (scheduler at 22:30)"
    echo "  service    Install as systemd timer service"
    echo "  logs       Tail the prediction log"
    echo "  status     Show current status"
    echo ""
    echo "Quick start:"
    echo "  ./setup.sh download"
    echo "  nano .env"
    echo "  ./setup.sh install"
    echo "  ./setup.sh train"
    echo "  ./setup.sh run"
}

# Main
case "${1:-}" in
    download) download ;;
    install) install ;;
    train) train ;;
    run) run ;;
    daemon) daemon ;;
    service) service ;;
    logs) logs ;;
    status) status ;;
    *) usage ;;
esac
