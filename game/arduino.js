var five = require("johnny-five");

// Tested reading from analog pins A1 - A11
var pinVolts = [
  0, // 0
  900, // Pin 1 - Fuel Cells 1, 4, and 5 Only
  900, // Pin 2 - Increase Hydrogen Pressure
  900, // Pin 3 - Booster L3
  900, // Pin 4 - From Buss B
  900, // Pin 5 Release Swing Arm
  900, // Pin 6 Booster Ignition
  900, // Pin 7 Guidance Control #2 
  950, // Pin 8 when user Grounds it
  967, // Pin 9 Rollover
  1001, // Pin 10 should have less than 1023
  900, // Pin 11 953, 1023
]

var connectBoard = function(station, board) {
  board.on("ready", function() {
    // Create an arduino object to pass around
    var ardy = this;
    // Once the board is connected, notify the commander that we're ready.
    station.socket.emit('stationJoined', {'stationId': station.id});
    this.samplingInterval(100);

    // For Testing, passes the led & socket objects to the REPL
    this.repl.inject({
      ardy: ardy
    });

    function addInput(board, i, vRead) {
      var vRead = pinVolts[i] || vRead;
      board.analogRead(i, function(voltage) {
        // console.log("Pin"+i+"Voltage is: "+voltage);
        if (!station.standby) {
          if (i == 10) {
            if (voltage < vRead ) {
              station.checkInput(i);
              // console.log("Pin"+i+"Voltage is: "+voltage);
            }
          }
        }
        if (voltage >= vRead && i != 10) {
          station.checkInput(i);
          // console.log("Pin"+i+"Voltage is: "+voltage);
          if (station.standby) {
            console.log("Reset Triggered by "+i);
            station.socket.emit('game_reset');
          }
        }
      });
    }

    function processPinIO(pinObject, val) {
      console.log("Is array: "+pinObject instanceof Array);
      if (pinObject instanceof Array) {
        for (var i = pinObject.length - 1; i >= 0; i--) {
          ardy.digitalWrite(pinObject[i], val);
        };
      } else {
        ardy.digitalWrite(pinObject, val);
      }
    }

    function processPinFlash(pinObject, command) {
      if (command) {
        var time = command.time ? command.time * 1000 : 10000;
      }
      function flash() {
        ardy.digitalWrite(pinObject, 1);

        ardy.wait(250, function() {
          // Turn it off...
          ardy.digitalWrite(pinObject, 0);
        });
      }
      var timey = setInterval(function() {
        flash();
      }, 500);
      setTimeout(function() {
        clearInterval(timey);
      }, time);
    }

    function processWiringCommands(command) {
      if (command.off != undefined) {
        console.log('Pin'+command.off+" Off!");
        processPinIO(command.off, 0);
      }
      if (command.flash != undefined) {
        console.log('Pin'+command.flash+" Flashing!");
        processPinIO(command.flash, command);
      }
      if (command.on != undefined) {
        console.log('Pin'+command.on+" On!");
        processPinIO(command.on, 1);
      }
    }

    addInput(this, 1);
    addInput(this, 2);
    addInput(this, 3);
    addInput(this, 4);
    addInput(this, 5);
    addInput(this, 6);
    addInput(this, 7);
    addInput(this, 8);
    addInput(this, 9);
    // addInput(this, 10);
    // addInput(this, 11);
    this.pinMode(21, five.Pin.OUTPUT);
    this.pinMode(22, five.Pin.OUTPUT);
    this.pinMode(23, five.Pin.OUTPUT);
    this.pinMode(24, five.Pin.OUTPUT);
    this.pinMode(25, five.Pin.OUTPUT);
    this.pinMode(26, five.Pin.OUTPUT);
    this.pinMode(27, five.Pin.OUTPUT);
    this.pinMode(28, five.Pin.OUTPUT);
    this.pinMode(29, five.Pin.OUTPUT);
    this.pinMode(30, five.Pin.OUTPUT);
    this.pinMode(31, five.Pin.OUTPUT);
    this.pinMode(32, five.Pin.OUTPUT);

    station.socket.on('station'+station.id, function(data) {
      var cmd = data.msg;
      var command = station.getCommand(data.cid);
      if (command.command == cmd || command.success == cmd) {
        processWiringCommands(command);
      }

      // on game misses show the red light for 2 seconds
      if (data.type == "failure") {
        ardy.digitalWrite(22, 1);
        setTimeout(function() {
          ardy.digitalWrite(22, 0);
        }, 2000);
      }

      // on game successes show the blue light for 2 seconds
      if (data.type == "success") {
        ardy.digitalWrite(24, 1);
        setTimeout(function() {
          ardy.digitalWrite(24, 0);
        }, 2000);
      }
    });

    station.socket.on('game_finished', function(data) {
      if (station.id == data.won) {
        ardy.digitalWrite(23, 1);
        processPinFlash(24);
      }

      if (station.id == data.lost) {
        ardy.digitalWrite(21, 1);
        processPinFlash(22);
      }
    });
    
  });
}

exports.connectBoard = connectBoard;