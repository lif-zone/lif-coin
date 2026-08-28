#!/bin/bash -e
cd ~/lif-wallet
git pull
cd ~/lif-kernel
rm -f package-lock.json
git pull
npm install
#sudo npm run serve-prod 
CMD='node ./web/server.js -s'
sudo capsh --caps="cap_net_bind_service,cap_setuid,cap_setgid,cap_setpcap+eip" --user="$USER" --addamb=cap_net_bind_service -- -c "$CMD"

