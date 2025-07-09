#!/bin/bash

# Pathology Bites Development Setup Script
# This script helps set up the development environment

set -e  # Exit on any error

echo "🧬 Pathology Bites Development Setup"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
check_node() {
    print_status "Checking Node.js installation..."
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js is installed: $NODE_VERSION"
        
        # Check if version is 18 or higher
        NODE_MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$NODE_MAJOR_VERSION" -lt 18 ]; then
            print_error "Node.js version 18 or higher is required. Current version: $NODE_VERSION"
            exit 1
        fi
    else
        print_error "Node.js is not installed. Please install Node.js 18 or higher."
        exit 1
    fi
}

# Check if npm is installed
check_npm() {
    print_status "Checking npm installation..."
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_success "npm is installed: $NPM_VERSION"
    else
        print_error "npm is not installed. Please install npm."
        exit 1
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    npm install
    print_success "Dependencies installed successfully"
}

# Set up environment file
setup_env() {
    print_status "Setting up environment configuration..."
    
    if [ ! -f ".env.local" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env.local
            print_success "Created .env.local from .env.example"
            print_warning "Please edit .env.local with your actual Supabase credentials"
        else
            print_error ".env.example not found. Please create it first."
            exit 1
        fi
    else
        print_warning ".env.local already exists. Skipping..."
    fi
}

# Check TypeScript
check_typescript() {
    print_status "Checking TypeScript configuration..."
    npm run type-check
    print_success "TypeScript check passed"
}

# Run tests
run_tests() {
    print_status "Running tests..."
    npm run test -- --passWithNoTests --silent
    print_success "Tests completed"
}

# Build the project
build_project() {
    print_status "Building the project..."
    npm run build
    print_success "Build completed successfully"
}

# Main setup process
main() {
    echo "Starting development environment setup..."
    echo ""
    
    # Check prerequisites
    check_node
    check_npm
    
    # Install and configure
    install_dependencies
    setup_env
    
    # Verify setup
    check_typescript
    run_tests
    build_project
    
    echo ""
    print_success "🎉 Development environment setup complete!"
    echo ""
    echo "Next steps:"
    echo "1. Edit .env.local with your Supabase credentials"
    echo "2. Run 'npm run dev' to start the development server"
    echo ""
    echo "For more information, see README.md or docs/development/DEVELOPER_SETUP.md"
}

# Run the main function
main
