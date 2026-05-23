#!/bin/bash

pkill -9 lif_node
rm -rf ~/lif.store/
node ~/lif-coin/bin/lif_node.js 
