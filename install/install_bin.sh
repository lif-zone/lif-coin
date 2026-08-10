#!/bin/bash -e

cd ~/lif-coin/install

BIN_FILES="ffind g gitdiff gitup rgrep start-coin-lifnet.sh start-coin.sh start-kernel-prod.sh start-kernel.sh tmux2.sh tmux.sh"
for i in $BIN_FILES; do
  cp ./$i ~/bin/
done
sudo cp ./lif-kernel.service /etc/systemd/system/
