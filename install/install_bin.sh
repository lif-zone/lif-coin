#!/bin/bash -e

cd ~/lif-coin/install

BIN_FILES="ffind g gitdiff gitup rgrep start-coin-lifnet.sh start-coin.sh
  start-kernel.sh tmux2.sh tmux.sh lif_reload_service.sh
  lif_start_service.sh lif_stop_service.sh"
for i in $BIN_FILES; do
  cp ./$i ~/bin/
done
SERV_FILES="lif-kernel.service lif-coin.service lif-coin-lifnet.service"
for i in $SERV_FILES; do
  sudo cp ./$i /etc/systemd/system/
done
echo "completed install"
