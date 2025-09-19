#!/bin/bash

echo "🔧 Disabling AirPlay Receiver to free port 5000..."

# Disable AirPlay Receiver
sudo defaults write /System/Library/LaunchDaemons/com.apple.AirPlayXPCHelper Disabled -bool true

# Kill any existing AirPlay processes
echo "🔪 Killing existing AirPlay processes..."
sudo killall AirPlayUIAgent 2>/dev/null || true
sudo killall AirPlayXPCHelper 2>/dev/null || true

# Kill any process using port 5000
echo "🔪 Killing any process using port 5000..."
lsof -ti:5000 | xargs kill -9 2>/dev/null || true

echo "✅ AirPlay Receiver disabled!"
echo "💡 To re-enable AirPlay, go to System Preferences > Sharing > AirPlay Receiver"
echo ""
echo "🎯 Port 5000 should now be free for your backend server!"
echo ""
echo "⚠️  Note: You may need to restart your Mac for changes to take full effect."