#!/bin/bash
cd ~/lif-wallet
git pull
cd ~/lif-kernel
rm package-lock.json
git pull
npm install
sudo npm run serve-prod 
# sudo node ./web/server.js -s
