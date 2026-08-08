#!/bin/bash
cd ~/lif-wallet
git pull
cd ~/lif-kernel
git pull
npm install
sudo npm run serve-prod 
