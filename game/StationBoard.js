var five = require("johnny-five");
var clientIo = require('socket.io-client');
RESETTING = false;
DEBUG = true;

var pinSettings = [
  { 
    pin: 0,
    voltage: 900,
    trigger: 'Default',
    voltageTrigger: 'min', // min readings should register a minimum of the voltage, so vRead >= voltage.
    lastReading: 500
  },
  { 
    pin: 1,
    voltage: 960,
    trigger: 'Fuel Cell 5',
    voltageTrigger: 'min', // min readings should register a minimum of the voltage, so vRead >= voltage.
    lastReading: 500
  },
  { 
    pin: 2,
    voltage: 1023,
    trigger: 'Increase Hydrogen Pressure',
    voltageTrigger: 'min', 
    lastReading: 500
  },
  { 
    pin: 3,
    voltage: 1023,
    trigger: 'Booster L3',
    voltageTrigger: 'min'
    lastReading: 500
  },
  { 
    pin: 4,
    voltage: 1023,
    trigger: 'Buss B',
    voltageTrigger: 'min',
    lastReading: 500
  },
  { 
    pin: 5,
    voltage: 1023,
    trigger: 'Release Swing Arm',
    voltageTrigger: 'min',
    lastReading: 500
  },
  { 
    pin: 6,
    voltage: 960,
    trigger: 'Booster Ignition',
    voltageTrigger: 'min',
    lastReading: 500
  },
  { 
    pin: 7,
    voltage: 1023,
    trigger: 'Guidance Control #2',
    voltageTrigger: 'min',
    lastReading: 500
  },
  { 
    pin: 8,
    voltage: 1023,
    trigger: 'Gyroscope',
    voltageTrigger: 'min',
    lastReading: 500
  },
  { 
    pin: 9,
    voltage: 1023,
    trigger: 'Rollover Sequence',
    voltageTrigger: 'min',
    lastReading: 500
  },
  { 
    pin: 10,
    voltage: 1001,
    trigger: 'Launch Button',
    voltageTrigger: 'max',
    lastReading: 1001
  },
  { 
    pin: 11,
    voltage: 960,
    trigger: 'Failure Pins',
    voltageTrigger: 'min',
    lastReading: 500
  }
]

// Station needs to own some things itself
function StationBoard(opts) {
  if ( !(this instanceof StationBoard) ) {
    return new StationBoard(opts);
  }
  this.init(opts);
}

// Object that pairs a single arduino with a Station object
StationBoard.prototype.init = function(opts) {
  this.id = opts.id; // * REQUIRED *
  this.board = opts.board; // * REQUIRED * The Arduino for a specific station
  this.socket = clientIo.connect('http://localhost:3000/arduinos');
  this.resetting = false;
  this.standby = false;
  this.activePins = [];

  // Do some setup
  this.setupInputs();
  this.setupListeners();
}

StationBoard.prototype.setupInputs = function() {
  if (this.board.isConnected && this.board.isReady) {
    this.announceConnected();
  } else {
    this.getBoardReady();
  }
}

StationBoard.prototype.setupListeners = function() {
  var sb = this;

  this.socket.on('connect', function() {
    console.log('ARDUINO SOCKET LIVE');
  });

  /* Listen for new commands
  Set pin to active when new command issued
  Process lights/sounds for new command */
  this.socket.on('command_command_'+sb.id, function(command) {

    console.log('COMMAND_COMMAND on Arduino Input ='+command.input);

    if (command.input) {
      sb.setPinActive(command.input);
    }

    sb.processWiringCommands(command);

    console.log('ACTIVE PINS = '+sb.activePins);
  });

  /* Listen for success and failure
    Issue new light/sounds for success/failure */
  this.socket.on('command_success_'+sb.id, function(command) {

    console.log('COMMAND_SUCCESS on Arduino Input ='+command.input);

    sb.successfulCommand(command);
    sb.processWiringCommands(command);

    // Play Success Audio
  });

  this.socket.on('command_failure_'+sb.id, function(command) {

    sb.failedCommand(command);

  });

  /* Listen for game finished
     Issue lights/sounds for game winner/loser */
  this.socket.on('game_finished', function(data) {

    sb.standby = true;
    sb.activePins = [];

    for (i = 25; i < 32; i += 1) {
      sb.processPinIO(i, 1);
    }

    if (sb.id == data.won) {

      sb.board.digitalWrite(23, 0);

      sb.processPinFlash(24);
    }
    console.log('GAME FINISHED FROM ARDUINO');

    // Play finish Music
  });

  this.socket.on('game_start', function() {
    sb.resetting = false;
    sb.standby = false;
    // Start the game with all alerts off: (1 = off) unless noted.
    sb.board.digitalWrite(21,1); // Fail Beacon
    sb.board.digitalWrite(22,1); // Fail Light
    sb.board.digitalWrite(23,1); // Success Beacon
    sb.board.digitalWrite(24,1); // Success Light
    sb.board.digitalWrite(25,0); // Hydrogen Light
    sb.board.digitalWrite(26,0); // Swing Arm Release
    sb.board.digitalWrite(27,0); // Gryoscope 
    sb.board.digitalWrite(28,0); // Launch Button
    sb.board.digitalWrite(29,1); // Fuel Cell 1 = on
    sb.board.digitalWrite(30,1); // Indicators 1 = on
    sb.board.digitalWrite(31,1); // rumble
    sb.board.digitalWrite(32,1); // Indicators 1 = on
  });

  /* Listen for station failure
     Show fail beacons */
  this.socket.on('station_removed', function(data) {

    if (sb.id == data.station) {
      for (i = 25; i < 32; i += 1) {
        sb.processPinIO(i, 1);
      }
      sb.board.digitalWrite(21, 0);
      sb.processPinFlash(22);
    }

    // Play Fail Audio

  });

}

StationBoard.prototype.getBoardReady = function() {
  var sb = this;
  this.board.on("ready", function() {
    // Create an arduino object to pass around
    var ardy = this;

    // Once the board is connected, notify the commander that we're ready.
    this.samplingInterval(250);

    // For Testing, passes the led & socket objects to the REPL
    this.repl.inject({
      ardy: ardy
    });

    // Prepare Inputs, then announce connected.
    sb.prepareInputs(function() {
      sb.announceConnected();
    });
  });
}

StationBoard.prototype.prepareInputs = function(callback) {
  this.addInput(1);
  this.addInput(2);
  this.addInput(3);
  this.addInput(4);
  this.addInput(5);
  this.addInput(6);
  this.addInput(7);
  this.addInput(8);
  this.addInput(9);
  this.addInput(10);
  this.addInput(11);
  this.board.pinMode(21, five.Pin.OUTPUT);
  this.board.pinMode(22, five.Pin.OUTPUT);
  this.board.pinMode(23, five.Pin.OUTPUT);
  this.board.pinMode(24, five.Pin.OUTPUT);
  this.board.pinMode(25, five.Pin.OUTPUT);
  this.board.pinMode(26, five.Pin.OUTPUT);
  this.board.pinMode(27, five.Pin.OUTPUT);
  this.board.pinMode(28, five.Pin.OUTPUT);
  this.board.pinMode(29, five.Pin.OUTPUT);
  this.board.pinMode(30, five.Pin.OUTPUT);
  this.board.pinMode(31, five.Pin.OUTPUT);
  this.board.pinMode(32, five.Pin.OUTPUT);
  setTimeout(function() {
    callback();
  }, 1000);
}

StationBoard.prototype.addInput = function(i) {
  var sb = this;
  var pin = pinSettings.filter(function(v) {
    return v.pin === i; // Filter out the appropriate one
  })[0];

  if (!this.inReset()) {
    this.board.analogRead(pin.pin, function(value) {
      sb.processVoltage(pin, value);
    });
  }
}

StationBoard.prototype.successfulCommand = function(command) {
  var sb = this;
  this.board.digitalWrite(24, 1); // ardy.digitalWrite(24, 1);
  setTimeout(function() {
    sb.board.digitalWrite(24, 0);
  }, 2000);
}

StationBoard.prototype.failedCommand = function(command) {
  var sb = this;
  sb.setPinInactive(command.input);
  this.board.digitalWrite(22, 1);
  setTimeout(function() {
    sb.board.digitalWrite(22, 0);
  }, 2000);
}

StationBoard.prototype.processVoltage = function(pin, voltage) {
  var sb = this;
  // console.log("@@@ PIN "+pin.pin+" @@@@@@@@ SWITCH VOLTAGE @@@@@@@@@@@@ "+voltage);
  // Check that we aren't in standby, and then check some inputs.
  if (!sb.inStandby()) {
    if (pin.pin == 10 && sb.isPinActive(pin.pin)) {
      if (voltage < pin.voltage) {
        sb.socket.emit('launch_fired', {station:sb.id, pin:pin.pin});
        // console.log("Pin"+i+"Voltage is: "+voltage);
      }
    } else {
      if (voltage >= pin.voltage && sb.isPinActive(pin.pin)) {
        console.log("@@@ PIN "+pin.pin+" @@@@@@@@ SWITCH VOLTAGE @@@@@@@@@@@@ "+voltage);
        sb.socket.emit('pin_fired', {station:sb.id, pin:pin.pin});
        sb.setPinInactive(pin.pin);
      }
    }
  } else {
    if (voltage >= pin.voltage) {
      if (pin.pin == 3 || pin.pin == 4 || pin.pin == 7) {
        sb.standby = false;
        sb.resetting = true;
        sb.socket.emit('game_reset', {station:sb.id});
      }
    }
  }
}

StationBoard.prototype.processPinIO = function(pinObject, val) {
  console.log("Is array: "+pinObject instanceof Array);
  if (pinObject instanceof Array) {
    for (var i = pinObject.length - 1; i >= 0; i--) {
      this.board.digitalWrite(pinObject[i], val);
    };
  } else {
    this.board.digitalWrite(pinObject, val);
  }
}

StationBoard.prototype.processPinFlash = function(pinObject, command) {
  var sb = this;
  if (command != undefined) {
    var time = command.timeLeft ? command.timeLeft * 1000 : 10000;
  }
  function flash() {
    sb.board.digitalWrite(pinObject, 1);

    sb.board.wait(250, function() {
      // Turn it off...
      sb.board.digitalWrite(pinObject, 0);
    });
  }

  var timey = setInterval(function() {
    flash();
  }, 500);

  setTimeout(function() {
    clearInterval(timey);
    sb.processPinIO(pinObject, 1);
  }, time);

}

StationBoard.prototype.processWiringCommands = function(command) {
  var sb = this;
  if (command.off != undefined) {
    console.log('Pin '+command.off+" Off!");
    this.processPinIO(command.off, 1);
  }
  if (command.flashOn != undefined) {
    console.log('Pin '+command.flashOn+" Flashing!");
    this.processPinFlash(command.flashOn, command);
  }
  if (command.on != undefined) {
    console.log('Pin '+command.on+" On!");
    this.processPinIO(command.on, 0);
  }

  if (command.toggle != undefined) {
    console.log('Pin '+command.toggle+" Toggled!");
    setTimeout(function() {
      sb.processPinIO(command.toggle, 0);
    }, command.timeLeft * 1000);
    sb.processPinIO(command.toggle, 1);
  }
  // TODO: Process sounds for new command.
}

StationBoard.prototype.announceConnected = function() {
  return this.socket.emit('arduino_connected', {board:this.id});
}

StationBoard.prototype.inReset = function() {
  return this.resetting;
}

StationBoard.prototype.inStandby = function() {
  return this.standby;
}

StationBoard.prototype.isPinActive = function(pin) {
  return this.activePins.indexOf(pin) > -1;
}

StationBoard.prototype.setPinActive = function(pin) {
  return this.activePins.push(pin);
}

StationBoard.prototype.setPinInactive = function(pin) {
  var index = this.activePins.indexOf(pin);
  if (index > -1) {
    this.activePins.splice(index, 1);
  }
  return this.activePins;
}

module.exports = StationBoard;