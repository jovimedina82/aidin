#!/bin/bash

# Database initialization script for IT Helpdesk Platform
echo "🚀 Initializing IT Helpdesk Platform Database..."

# Wait for the application to be ready
echo "⏳ Waiting for application to start..."
sleep 10

# Check if database exists and initialize if needed
if [ ! -f "/app/data/helpdesk.db" ]; then
    echo "📁 Creating database directory..."
    mkdir -p /app/data
    
    echo "🗃️ Running database migrations..."
    npx prisma migrate deploy
    
    echo "🌱 Seeding database with initial data..."
    npx prisma db seed
    
    echo "✅ Database initialization complete!"
else
    echo "📊 Database already exists, running migrations..."
    npx prisma migrate deploy
fi

echo "🎉 IT Helpdesk Platform is ready!"
echo "🌐 Access the application at: http://localhost:3000"
echo "👤 Default admin account: admin@surterreproperties.com / admin123"
