#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "Starting setup on AWS instance..."

# 1. Update system packages
echo "Updating system packages..."
sudo apt-get update || sudo yum update -y

# 2. Create Swap Space (Critical for low-memory instances installing TensorFlow)
# Check if swapfile already exists
if [ ! -f /swapfile ]; then
    echo "Creating 4GB swap file to prevent OOM errors..."
    sudo fallocate -l 4G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "Swap file created and enabled."
else
    echo "Swap file already exists. Skipping."
fi

# 3. Install Python and Pip (if not already installed)
echo "Ensuring Python and Pip are installed..."
if command -v apt-get &> /dev/null; then
    sudo apt-get install -y python3 python3-pip python3-venv
elif command -v yum &> /dev/null; then
    sudo yum install -y python3 python3-pip
fi

# 4. Create a Virtual Environment (Recommended)
if [ ! -d "venv" ]; then
    echo "Creating virtual environment 'venv'..."
    python3 -m venv venv
fi

# 5. Activate Virtual Environment
echo "Activating virtual environment..."
source venv/bin/activate

# 6. Install Dependencies
echo "Installing dependencies from requirements.txt..."
# Using --no-cache-dir to save memory during installation
pip install --upgrade pip
pip install -r requirements.txt --no-cache-dir

echo "------------------------------------------------"
echo "Setup complete! To activate the environment run:"
echo "source venv/bin/activate"
echo "------------------------------------------------"
