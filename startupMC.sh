#!/bin/sh
. /etc/rc.common
 
# The start subroutine
StartService() {
    # Insert your start command below.  For example:
    cd ~/mission-control
    nodemon index.js
    # End example.
}
 
# The stop subroutine
StopService() {
    # Insert your stop command(s) below.  For example:
    killall -TERM node
    sleep 10
    killall -9 node
    # End example.
}
 
# The restart subroutine
RestartService() {
    # Insert your start command below.  For example:
    killall -HUP node
    cd ~/mission-control
    nodemon index.js
    # End example.
}
 
RunService "$1"