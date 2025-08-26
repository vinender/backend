#!/bin/bash

# Wait for MongoDB to be ready
MAX_ATTEMPTS=30
ATTEMPT=0

echo "Waiting for MongoDB to be ready..."
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if mongosh --quiet --eval "db.adminCommand('ping')" 2>/dev/null; then
        echo "MongoDB is ready"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    sleep 1
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "MongoDB failed to start within 30 seconds"
    exit 1
fi

# Check if replica set is initialized
RS_STATUS=$(mongosh --quiet --eval "rs.status().ok" 2>/dev/null)

if [ "$RS_STATUS" != "1" ]; then
    echo "Initializing replica set..."
    mongosh --quiet --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'localhost:27017'}]})"
    
    # Wait for replica set to become primary
    echo "Waiting for replica set to become primary..."
    for i in {1..30}; do
        IS_PRIMARY=$(mongosh --quiet --eval "rs.isMaster().ismaster" 2>/dev/null)
        if [ "$IS_PRIMARY" == "true" ]; then
            echo "Replica set is now primary"
            break
        fi
        sleep 1
    done
else
    echo "Replica set already initialized and running"
fi

# Verify connection works
mongosh --quiet --eval "db.adminCommand('ping')" && echo "MongoDB replica set is fully operational"