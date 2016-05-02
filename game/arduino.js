var five = require("johnny-five");

// Tested reading from analog pins A1 - A11
var pinVolts = [
  0, // 0
  949, // Pin 1
  1023, // Pin 2 is broken, 1023 when Decreased
  1023, // Pin 3
  1023, // Pin 4
  0, // Pin 5 is borked 1023, no change
  967, // Pin 6
  1023, // Pin 7
  1023, // Pin 8 when user Grounds it
  967, // Pin 9
  1020, // Pin 10 should have less than 1023
  -1, // Pin 11 953, 1023
]

var connectBoard = function(station, board) {
  board.on("ready", function() {
    // Create an Led on pin 13
    var ardy = this;
    // Once the board is connected, notify the commander that we're ready.
    station.socket.emit('stationJoined', {'stationId': station.id});
    station.ready = true;

    // For Testing, passes the led & socket objects to the REPL
    this.repl.inject({
      ardy: ardy
    });

    function addInput(board, i, vRead) {
      var vRead = pinVolts[i] || vRead;
      board.analogRead(i, function(voltage) {
        // console.log("Pin"+i+"Voltage is: "+voltage);
        if (voltage == vRead) {
          station.checkInput(i);
          console.log("Pin"+i+"Voltage is: "+voltage);
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

    function processPinFlash(pinObject) {
      if (pinObject instanceof Array) {
        for (var i = pinObject.length - 1; i >= 0; i--) {
          var timey = setInterval(function() {
            var led = new five.Led(pinObject[i]);
          }, 500);
          setTimeout(function() {
            clearInterval(timey);
          }, station.getCurrentCommand().time * 1000);
        };
      } else {
        var led = new five.Led(pinObject);
        led.strobe();
      }
    }

    function processWiringCommands(command) {
      if (command.off != undefined) {
        console.log('Pin'+command.off+" Off!");
        processPinIO(command.off, 0);
      }
      if (command.flash != undefined) {
        console.log('Pin'+command.flash+" Flashing!");
        processPinIO(command.flash);
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
    addInput(this, 10);
    addInput(this, 11);
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
      var command = station.getCurrentCommand();
      if (command.command == cmd || command.success == cmd) {
        processWiringCommands(command);
      }
    });
    
  });
}

exports.connectBoard = connectBoard;