#!/bin/bash

echo "Setting up MongoDB Replica Set for local development..."

# Kill any existing mongod process
echo "Stopping existing MongoDB processes..."
brew services stop mongodb-community 2>/dev/null
pkill mongod 2>/dev/null

# Create data directory if it doesn't exist
mkdir -p ~/data/mongodb-replica

# Start MongoDB with replica set
echo "Starting MongoDB with replica set..."
mongod --dbpath ~/data/mongodb-replica --replSet rs0 --bind_ip localhost --port 27017 &

# Wait for MongoDB to start
echo "Waiting for MongoDB to start..."
sleep 5

# Initialize replica set
echo "Initializing replica set..."
mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'localhost:27017'}]})"

echo "MongoDB replica set setup complete!"
echo "Connection string: mongodb://localhost:27017/fieldsy?replicaSet=rs0"
echo ""
echo "To stop MongoDB: pkill mongod"
echo "To restart: mongod --dbpath ~/data/mongodb-replica --replSet rs0 --bind_ip localhost --port 27017"