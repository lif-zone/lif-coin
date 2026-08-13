#!/bin/bash -e

if [ "$1" == start ] ; then
  sudo systemctl daemon-reload
  sudo systemctl start lif-kernel
  sudo systemctl status lif-kernel
  sudo systemctl start lif-coin
  sudo systemctl status lif-coin
  sudo systemctl start lif-coin-lifnet
  sudo systemctl status lif-coin-lifnet
elif [ "$1" == stop ] ; then
  sudo systemctl stop lif-kernel
  sudo systemctl stop lif-coin
  sudo systemctl stop lif-coin-lifnet
elif [ "$1" == restart ] ; then
  sudo systemctl daemon-reload
  sudo systemctl restart lif-kernel
  sudo systemctl status lif-kernel
  sudo systemctl restart lif-coin
  sudo systemctl status lif-coin
  sudo systemctl restart lif-coin-lifnet
  sudo systemctl status lif-coin-lifnet
elif [[ "$1" == status || "$1" == "" ]] ; then
  sudo systemctl status lif-kernel
  sudo systemctl status lif-coin
  sudo systemctl status lif-coin-lifnet
elif [ "$1" == enable ] ; then
  sudo systemctl enable lif-kernel
  sudo systemctl enable lif-coin
  sudo systemctl enable lif-coin-lifnet
elif [ "$1" == disable ] ; then
  sudo systemctl stop lif-kernel
  sudo systemctl disable lif-kernel
  sudo systemctl stop lif-coin
  sudo systemctl disable lif-coin
  sudo systemctl stop lif-coin-lifnet
  sudo systemctl disable lif-coin-lifnet
elif [ "$1" == is-enabled ] ; then
  sudo systemctl is-enabled lif-kernel
  sudo systemctl is-enabled lif-coin
  sudo systemctl is-enabled lif-coin-lifnet
else
  echo "lif_service.sh start|stop|restart|status|enable|disable|is-enabled"
fi

