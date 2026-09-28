#!/bin/bash
sudo systemd-run --pty --uid=lif --property=AmbientCapabilities=CAP_NET_BIND_SERVICE node /home/lif/lif-kernel/web/server.js

