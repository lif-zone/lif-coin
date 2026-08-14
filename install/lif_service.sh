#!/bin/bash -e

if [ "$1" == start ] ; then
  sudo systemctl daemon-reload
  sudo systemctl start lif-kernel
  sudo systemctl status lif-kernel
  sudo systemctl start lif-coin
  sudo systemctl status lif-coin
  sudo systemctl start lif-coin-lifnet
  sudo systemctl status lif-coin-lifnet
  sudo systemctl start lif-explorer
  sudo systemctl status lif-explorer
elif [ "$1" == stop ] ; then
  sudo systemctl stop lif-kernel || true
  sudo systemctl stop lif-coin || true
  sudo systemctl stop lif-coin-lifnet || true
  sudo systemctl stop lif-explorer || true
elif [ "$1" == restart ] ; then
  sudo systemctl daemon-reload
  sudo systemctl restart lif-kernel
  sudo systemctl status lif-kernel
  sudo systemctl restart lif-coin
  sudo systemctl status lif-coin
  sudo systemctl restart lif-coin-lifnet
  sudo systemctl status lif-coin-lifnet
  sudo systemctl restart lif-explorer
  sudo systemctl status lif-explorer
elif [ "$1" == status ] ; then
  sudo systemctl status lif-kernel || true
  sudo systemctl status lif-coin || true
  sudo systemctl status lif-coin-lifnet || true
  sudo systemctl status lif-explorer || true
elif [ "$1" == enable ] ; then
  sudo systemctl enable lif-kernel
  sudo systemctl enable lif-coin
  sudo systemctl enable lif-coin-lifnet
  sudo systemctl enable lif-explorer
elif [ "$1" == disable ] ; then
  sudo systemctl stop lif-kernel || true
  sudo systemctl disable lif-kernel
  sudo systemctl stop lif-coin || true
  sudo systemctl disable lif-coin
  sudo systemctl stop lif-coin-lifnet || true
  sudo systemctl disable lif-coin-lifnet
  sudo systemctl stop lif-explorer || true
  sudo systemctl disable lif-explorer
elif [ "$1" == is-enabled ] ; then
  sudo systemctl is-enabled lif-kernel || true
  sudo systemctl is-enabled lif-coin || true
  sudo systemctl is-enabled lif-coin-lifnet || true
  sudo systemctl is-enabled lif-explorer || true
elif [ "$1" == install ] ; then
  (cd ~/lif-kernel && git pull)
  (cd ~/lif-coin && git pull)
  (cd ~/lif-wallet && git pull)
  (cd ~/lif-explorer && git pull)
  (cd ~/lif-os && git pull)
  ~/lif-coin/install/install_bin.sh
  (cd ~/lif-kernel && npm install)
  (cd ~/lif-coin && npm install)
  (cd ~/lif-explorer && npm install)
elif [ "$1" == update ] ; then
  (cd ~/lif-kernel && git pull)
  (cd ~/lif-coin && git pull)
  (cd ~/lif-wallet && git pull)
  (cd ~/lif-explorer && git pull)
  (cd ~/lif-os && git pull)
  ~/lif-coin/install/install_bin.sh
  echo "now run: lif_service.sh restart"
else
  echo "lif_service.sh start|stop|restart|status|..."
  echo "  start: starts systemd services"
  echo "  stop: stops systemd services"
  echo "  restart - stop and starts systemd services"
  echo "  status: shows status of systemd services"
  echo "  disable: disable systemd services"
  echo "  enable: enable systemd services (will run on reboot)"
  echo "  is-enabled: shows services status: enabled/running/last log..."
  echo "  update: updates git trees"
  echo "  install: installs ~/bin, systemd, git pull and npm install"
fi

