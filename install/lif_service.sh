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
elif [ "$1" == reload ] ; then
  sudo systemctl daemon-reload
  sudo systemctl restart lif-kernel
  sudo systemctl status lif-kernel
  sudo systemctl restart lif-coin
  sudo systemctl status lif-coin
  sudo systemctl restart lif-coin-lifnet
  sudo systemctl status lif-coin-lifnet
elif [ "$1" == status || "$1" == "" ] ; then
else
  echo "lif_service.sh start|stop|reload|status"
fi

