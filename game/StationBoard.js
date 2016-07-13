var five = require("johnny-five");
var clientIo = require('socket.io-client');
var pinSettings = require('./pinSettings.js');
var outputs = require('./outputs.js');
RESETTING = false;
DEBUG = true;

function getOutput(onum) {
  var output = outputs.filter(function(v) {
    return v.pin === onum; // Filter out the appropriate one
  })[0];
  return output;
}

function getOutputBySlug(slug) {
  var output = outputs.filter(function(v) {
    return v.slug === slug; // Filter out the appropriate one
  })[0];
  return output;
}

function getPin(pnum) {
  var pin = pinSettings.filter(function(v) {
    return v.pin === pnum; // Filter out the appropriate one
  })[0];
  return pin;
}

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
    sb.playAllAudio(false);

    for (i = 25; i < 32; i += 1) {
      sb.processPinIO(i, "off");
    }

    if (sb.id == data.won ) {

      sb.board.digitalWrite(23, 0);
      sb.processPinFlash(24, {timeLeft:30000});
      // Play winner music
      sb.playAudio('winSound', true);
    }
    console.log('GAME FINISHED FROM ARDUINO');
    setTimeout(function() {
      sb.socket.emit('station_standby', {station: sb.id});
    }, 6000);

  });

  this.socket.on('game_over', function(data) {
    console.log("GAME OVER!");
    sb.standby = true;
    sb.activePins = [];
    sb.playAllAudio(false);

    for (i = 25; i < 32; i += 1) {
      sb.processPinIO(i, "off");
    }

    if (sb.id == data.won && sb.id != data.removed) {

      sb.board.digitalWrite(23, 0);
      sb.processPinFlash(24, {timeLeft:30000});
      // Play winner music
      sb.playAudio('winSound', true);
    } else {
      sb.board.digitalWrite(21, 0);
      sb.processPinFlash(22, {timeLeft:30000});
      // Play fail music
      sb.playAudio('failSound', true);
    }
    console.log('GAME FINISHED FROM ARDUINO');
    setTimeout(function() {
      sb.socket.emit('station_standby', {station: sb.id});
    }, 6000);

  });

  this.socket.on('game_start', function() {
    sb.resetting = false;
    sb.standby = false;
    sb.playAllAudio(false);
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
    sb.board.digitalWrite(31,0); // rumble
    sb.board.digitalWrite(32,1); // Indicators 1 = on
    sb.board.digitalWrite(44,1); // Indicators 1 = on
  });

  /* Listen for station failure
     Show fail beacons */
  this.socket.on('station_removed', function(data) {
    console.log('station lost');
    if (sb.id == data.station) {
      for (i = 25; i < 32; i += 1) {
        sb.processPinIO(i, "off");
      }
      sb.board.digitalWrite(21, 0);
      sb.processPinFlash(22, {timeLeft:30000});
    }

    // Play Fail Audio
    sb.playAudio('failSound', true);

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
  var sb = this;
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
  this.addInput(13);
  this.addInput(14);
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
  // Audio
  this.board.pinMode(40, five.Pin.OUTPUT);
  this.board.pinMode(41, five.Pin.OUTPUT);
  this.board.pinMode(42, five.Pin.OUTPUT);
  this.board.pinMode(43, five.Pin.OUTPUT);
  this.board.pinMode(44, five.Pin.OUTPUT);
  setTimeout(function() {
    callback();
  }, 1000);
  // Turn off the annoying noises
  sb.playAllAudio(false);
}

StationBoard.prototype.addInput = function(i) {
  var sb = this;
  var pin = getPin(i);

  if (!this.inReset()) {
    this.board.analogRead(pin.pin, function(value) {
      sb.processVoltage(pin, value);
    });
  }
}

StationBoard.prototype.successfulCommand = function(command) {
  var sb = this;
  sb.processPinIO(24, 'on');
  setTimeout(function() {
    sb.processPinIO(24, 'off');
  }, 2000);
  sb.playAudio('successSound', true);
}

StationBoard.prototype.failedCommand = function(command) {
  var sb = this;
  sb.setPinInactive(command.input);
  sb.processPinIO(22, 'on');
  setTimeout(function() {
    sb.processPinIO(22, 'off');
  }, 2000);
  // this.playAudio('failSound', true);
}

StationBoard.prototype.playAllAudio = function(play) {
  this.playAudio('failSound', play);
  this.playAudio('successSound', play);
  this.playAudio('winSound', play);
  this.playAudio('loseSound', play);
}

StationBoard.prototype.playAudio = function(slug, play) {
  var sb = this;
  var output = getOutputBySlug(slug);
  console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! PLAY AUDIO "+output.pin+" on:"+play);
  var delay = slug == 'failSound' ? 3000 : 500;
  // get length of audio output.length
  var i = play ? output.on : output.off;
  sb.board.digitalWrite(output.pin, i);
  if (play) {
    sb.board.wait(delay, function() {
      sb.board.digitalWrite(output.pin, output.off);
    })
  }
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
      if (voltage >= pin.voltage && pin.pin != 10) {
        // console.log(+pin.pin+" SWITCH VOLTAGE @@@"+sb.id+"@@"+pin.pin+"@"+pin.pin+"@@"+pin.pin+"@"+pin.pin+"@@"+pin.pin+"@ "+voltage);
        sb.socket.emit('pin_fired', {station:sb.id, pin:pin.pin});
        sb.setPinInactive(pin.pin);
      }
    }
  } else {
    // If we ARE in standby then let's reset.
    if (pin.pin == 10 && voltage < pin.voltage) {
      console.log('STATION RESET TRIGGERED BY '+pin.pin+' STATION ID: '+sb.id);
      sb.standby = false;
      sb.resetting = true;
      sb.socket.emit('station_reset', {station:sb.id});
    }
  }
}

StationBoard.prototype.processPinIO = function(pinObject, dir) {
  console.log("Is array: "+pinObject instanceof Array);

  if (pinObject instanceof Array) {
    for (var i = pinObject.length - 1; i >= 0; i--) {
      var pin = getOutput(pinObject[i]);
      var direction = dir == "on" ? pin.on : pin.off;
      this.board.digitalWrite(pin.pin, direction);
    };
  } else {
    var pin = getOutput(pinObject);
    var direction = dir == "on" ? pin.on : pin.off;
    console.log("DIRECTION ************** "+direction);
    this.board.digitalWrite(pin.pin, direction);
  }
}

StationBoard.prototype.processPinFlash = function(pinObject, command) {
  var sb = this;
  var time = 3000;
  if (command != undefined) {
    time = command.timeLeft;
  }
  function flash() {
    sb.processPinIO(pinObject, 'on');

    sb.board.wait(250, function() {
      // Turn it off...
      sb.processPinIO(pinObject, 'off');
    });
  }

  var timey = setInterval(function() {
    flash();
  }, 500);

  setTimeout(function() {
    clearInterval(timey);
    sb.processPinIO(pinObject, 'off');
  }, time);

}

StationBoard.prototype.processWiringCommands = function(command) {
  var sb = this;
  if (command.off != undefined) {
    console.log('Pin '+command.off+" Off!");
    this.processPinIO(command.off, 'off');
  }
  if (command.flashOn != undefined) {
    console.log('Pin '+command.flashOn+" Flashing!");
    this.processPinFlash(command.flashOn, command);
  }
  if (command.on != undefined) {
    console.log('Pin '+command.on+" On!");
    this.processPinIO(command.on, 'on');
  }

  if (command.toggle != undefined) {
    console.log('Pin '+command.toggle+" Toggled!");
    setTimeout(function() {
      sb.processPinIO(command.toggle, 'off');
    }, command.timeLeft * 1000);
    sb.processPinIO(command.toggle, 'on');
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