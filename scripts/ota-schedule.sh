#!/bin/bash

# OTA Update Scheduler for Sugarcane Devices
# This script schedules an OTA update to trigger at 3am Singapore time (SGT)
#
# Usage:
#   ./ota-schedule.sh                    # Update all devices
#   ./ota-schedule.sh 852277             # Update single device
#   ./ota-schedule.sh 852277 852278      # Update multiple devices
#   ./ota-schedule.sh --now 852277       # Trigger immediately (for testing)
#
# The script will:
# 1. Calculate time until 3am SGT
# 2. Wait until that time
# 3. Trigger the OTA update for specified devices

# Configuration
API_URL="${OTA_API_URL:-https://sugarcane-backend-five.vercel.app/api/app/version}"
ADMIN_KEY="${OTA_ADMIN_KEY:-sugarcane123}"
TARGET_HOUR=3  # 3am SGT

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
TRIGGER_NOW=false
DEVICES=()

for arg in "$@"; do
    if [ "$arg" == "--now" ] || [ "$arg" == "-n" ]; then
        TRIGGER_NOW=true
    else
        DEVICES+=("$arg")
    fi
done

# Build devices JSON
if [ ${#DEVICES[@]} -eq 0 ]; then
    DEVICES_JSON='"all"'
    DEVICES_DESC="ALL devices"
else
    # Build JSON array
    DEVICES_JSON='['
    for i in "${!DEVICES[@]}"; do
        if [ $i -gt 0 ]; then
            DEVICES_JSON+=','
        fi
        DEVICES_JSON+="\"${DEVICES[$i]}\""
    done
    DEVICES_JSON+=']'
    DEVICES_DESC="${DEVICES[*]}"
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Sugarcane OTA Update Scheduler${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Target devices:${NC} $DEVICES_DESC"
echo -e "${YELLOW}API URL:${NC} $API_URL"
echo ""

# Function to trigger OTA
trigger_ota() {
    echo -e "${GREEN}Triggering OTA update...${NC}"

    RESPONSE=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d "{
            \"action\": \"trigger\",
            \"devices\": $DEVICES_JSON,
            \"adminKey\": \"$ADMIN_KEY\"
        }")

    echo -e "${GREEN}Response:${NC} $RESPONSE"

    # Check if successful
    if echo "$RESPONSE" | grep -q '"success":true'; then
        echo ""
        echo -e "${GREEN}OTA update triggered successfully at $(TZ='Asia/Singapore' date '+%Y-%m-%d %H:%M:%S') SGT${NC}"
    else
        echo ""
        echo -e "${RED}Failed to trigger OTA update${NC}"
        exit 1
    fi
}

# If --now flag, trigger immediately
if [ "$TRIGGER_NOW" = true ]; then
    echo -e "${YELLOW}Triggering immediately (--now flag)${NC}"
    trigger_ota
    exit 0
fi

# Calculate seconds until 3am SGT
calculate_wait_time() {
    # Get current time in SGT
    CURRENT_SGT=$(TZ='Asia/Singapore' date '+%s')
    CURRENT_HOUR=$(TZ='Asia/Singapore' date '+%H')
    CURRENT_MIN=$(TZ='Asia/Singapore' date '+%M')
    CURRENT_SEC=$(TZ='Asia/Singapore' date '+%S')

    # Calculate target time (3am today or tomorrow)
    TARGET_TODAY=$(TZ='Asia/Singapore' date -v${TARGET_HOUR}H -v0M -v0S '+%s' 2>/dev/null)

    # macOS fallback
    if [ -z "$TARGET_TODAY" ]; then
        # Get today's date in SGT
        TODAY_DATE=$(TZ='Asia/Singapore' date '+%Y-%m-%d')
        TARGET_TODAY=$(TZ='Asia/Singapore' date -j -f '%Y-%m-%d %H:%M:%S' "${TODAY_DATE} ${TARGET_HOUR}:00:00" '+%s' 2>/dev/null)
    fi

    # Linux alternative
    if [ -z "$TARGET_TODAY" ]; then
        TODAY_DATE=$(TZ='Asia/Singapore' date '+%Y-%m-%d')
        TARGET_TODAY=$(TZ='Asia/Singapore' date -d "${TODAY_DATE} ${TARGET_HOUR}:00:00" '+%s' 2>/dev/null)
    fi

    # Calculate wait time
    WAIT_SECONDS=$((TARGET_TODAY - CURRENT_SGT))

    # If target time has passed today, schedule for tomorrow
    if [ $WAIT_SECONDS -le 0 ]; then
        WAIT_SECONDS=$((WAIT_SECONDS + 86400))  # Add 24 hours
    fi

    echo $WAIT_SECONDS
}

# Get wait time
WAIT_SECONDS=$(calculate_wait_time)
WAIT_HOURS=$((WAIT_SECONDS / 3600))
WAIT_MINS=$(((WAIT_SECONDS % 3600) / 60))

# Display schedule info
TRIGGER_TIME=$(TZ='Asia/Singapore' date -v+${WAIT_SECONDS}S '+%Y-%m-%d %H:%M:%S' 2>/dev/null)
if [ -z "$TRIGGER_TIME" ]; then
    TRIGGER_TIME=$(TZ='Asia/Singapore' date -d "+${WAIT_SECONDS} seconds" '+%Y-%m-%d %H:%M:%S' 2>/dev/null)
fi

echo -e "${YELLOW}Current time (SGT):${NC} $(TZ='Asia/Singapore' date '+%Y-%m-%d %H:%M:%S')"
echo -e "${YELLOW}Scheduled trigger:${NC} ${TRIGGER_TIME} SGT"
echo -e "${YELLOW}Wait time:${NC} ${WAIT_HOURS}h ${WAIT_MINS}m (${WAIT_SECONDS} seconds)"
echo ""
echo -e "${BLUE}Waiting for 3am SGT to trigger OTA update...${NC}"
echo -e "${BLUE}Press Ctrl+C to cancel${NC}"
echo ""

# Progress indicator
show_progress() {
    local remaining=$1
    local hours=$((remaining / 3600))
    local mins=$(((remaining % 3600) / 60))
    local secs=$((remaining % 60))
    printf "\r${YELLOW}Time remaining: %02d:%02d:%02d${NC}   " $hours $mins $secs
}

# Wait with progress updates
REMAINING=$WAIT_SECONDS
while [ $REMAINING -gt 0 ]; do
    show_progress $REMAINING
    sleep 60  # Update every minute
    REMAINING=$((REMAINING - 60))

    # Don't go negative
    if [ $REMAINING -lt 0 ]; then
        REMAINING=0
    fi
done

echo ""
echo ""

# Trigger OTA
trigger_ota
