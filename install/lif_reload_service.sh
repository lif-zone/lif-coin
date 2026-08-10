#!/bin/bash -e
sudo systemctl daemon-reload
sudo systemctl restart lif-kernel
sudo systemctl status lif-kernel
sudo systemctl restart lif-coin
sudo systemctl status lif-coin
sudo systemctl restart lif-coin-lifnet
sudo systemctl status lif-coin-lifnet

