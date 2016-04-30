var five = require("johnny-five");
var clientIo = require('socket.io-client');
var CommandFactory = require('./CommandFactory');

STATION_COUNT = 2;
DEFAULT_WAIT_TIME = 5000;
PORTS = ["/dev/cu.usbmodem1421", "/dev/cu.usbmodem1411"];

// ----------------------------------------- STATION ---------------------- //
// **************************************************************************//

// Station needs to own some things itself
function Station(id) {
  console.log("new Station")
  if ( !(this instanceof Station) ) {
    return new Station();
  }
  this.init(id);
}

Station.prototype.init = function(id) {
  this.commands = [];
  this.currentStep = 0;
  this.currentCommand = {};
  this.socket = clientIo.connect('http://localhost:3000/');
  this.id = id; 
  this.createdTime = new Date().getTime();
  this.lastActiveTime = new Date().getTime();
  this.lastWinTime = 0;
  this.points = 0;
  this.failures = 0;
  this.completed = 0;
  this.misses = 0;
  this.name = 'Station_' + id;
  this.board = new five.Board(PORTS[id]);
  this.timer = {};
  this.connectBoard();
  this.ready = false;
}

Station.prototype.connectBoard = function() {
  var station = this;
  console.log(this.ready);
  // When board is connected lets' connect this station
  this.board.on("ready", function() {
    // Create an Led on pin 13
    var led = new five.Led(13);
    var ardy = this;
    // Once the board is connected, notify the commander that we're ready.
    station.socket.emit('stationJoined', {'stationId': station.id});
    station.ready = true;

    // For Testing, passes the led & socket objects to the REPL
    this.repl.inject({
      led: led
    });

    function addInput(board, i, vRead) {
      var vRead = 1023 || vRead;
      board.analogRead(i, function(voltage) {
        if (voltage == vRead) {
          station.checkInput(i);
        }
      });
    }

    function processPinIO(pinObject, val) {
      // if (typeof(pinObject) == Array) {
      //   for (var i = pinObject.length - 1; i >= 0; i--) {
      //     ardy.digitalWrite(pinObject[i], val);
      //   };
      // } else {
      //   ardy.digitalWrite(pinObject, val);
      // }
    }

    function processPinFlash(pinObject) {
      // if (typeof(pinObject) == Array) {
      //   for (var i = pinObject.length - 1; i >= 0; i--) {
      //     var timey = setInterval(function() {
      //       ardy.digitalWrite(13, 1);
      //     }, 500);
      //     setTimeout(function() {
      //       clearInterval(timey);
      //     }, station.getCurrentCommand().time)
      //   };
      // } else {
      //   ardy.digitalWrite(pinObject, val);
      // }
    }

    function processWiringCommands(command) {
      if (command.off != undefined) {
        console.log('Pin'+command.off+" Off!");
        processPinIO(command.off, 0);
      }
      if (command.flash != undefined) {
        console.log('Pin'+command.flash+" Flashing!");
        // ardy.digitalWrite(command.flash, 0);
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

    station.socket.on('station'+station.id, function(cmd) {
      command = station.getCurrentCommand();
      if (command.command == cmd) {
        processWiringCommands(command);
      }
    });
    
  });

}

Station.prototype.checkInput = function(pin) {
  var station = this;
  if (this.getCurrentCommand().input == pin) {
    if (station.completed < station.currentStep) {
      station.completed++;
      station.points += 100;
      station.emitCommand(station.getCurrentCommand().success);
      station.socket.emit('success', {'station':station.id})
    }
  } else {
    station.misses++;
    console.log('Missed!')
  }
}
Station.prototype.nextCommand = function(cmd) {
  var c = this.currentCommand = this.commands[this.currentStep];
  var command = c.command;
  var nextCommandDelayMs = c.buffer * 1000;
  var timeToFixMs = c.time * 1000;
  var station = this;
  var actionStep = this.currentStep;

  while (this.failures >= 3) {
    return;
  }
  this.currentStep++;

  this.emitCommand(command);


  this.timer = setTimeout(function() {
    station.checkAnswer(actionStep, timeToFixMs);
  }, nextCommandDelayMs);
}

Station.prototype.checkAnswer = function(actionStep, timeToFixMs) {
  var station = this;
  console.log("Awaiting Input?:"+this.awaitingInput(actionStep)+" ActStep"+actionStep);
  while (this.getCurrentCommand().input == null) {
    setTimeout(function() {
      station.nextCommand();
    }, DEFAULT_WAIT_TIME);
    return;
  }
  if (this.awaitingInput(actionStep)) {
    station.emitCommand(station.getCurrentCommand().hint);
    setTimeout(function() {
      console.log("The Score:" +station.points+ "- The Step:" +actionStep);
      if (station.awaitingInput(actionStep)) {
        station.emitCommand('Failure!');
        station.failures++;
        station.completed++;
        station.nextCommand();
      }
    }, timeToFixMs);
  }
}

Station.prototype.awaitingInput = function(actionStep) {
  return this.completed <= actionStep;
}

Station.prototype.emitCommand = function(cmd) {
  // this.socket.broadcast.emit("station"+this.id, cmd);
  this.socket.emit("command", {'station':this.id, 'cmd':cmd});
  console.log("Station Command: "+this.id+" "+cmd);
  console.log("Station Stats - Completed:"+this.completed+" Current:"+this.currentStep+" Points:"+this.points);
}

Station.prototype.getCurrentCommand = function() {
  return this.currentCommand;
}

Station.prototype.startGame = function() {
  var c = new CommandFactory();
  var station = this;

  this.commands = c.getCommands();

  // Emit the next command in the list
  this.nextCommand()

  // setup listener for next_question
  this.socket.on("next_question", function(data) {
    console.log("Next Questions!");
    if (data.station == station.id) {
      clearTimeout(station.timer);
      station.nextCommand();
    }
  });

}

// ----------------------------------------- STATIONS ---------------------- //
// **************************************************************************//

function Stations() {
  if ( !(this instanceof Stations) ) {
    return new Stations();
  }
  this.init();
}

Stations.prototype.init = function() {
  this.stations = {};
  this.stationCount = 0; // count of total stations joined, not active stations
  this.activeStationCount = 0; // count of stations currently connected
  this.winningSocket = null;
}

// Setup 4 stations for our game
Stations.prototype.createStations = function() {
  for (var i = 0; i < STATION_COUNT; i++) {
    console.log("iterator: "+i);
    var p = this.addStation(i + 1);
  };
}

Stations.prototype.addStation = function(stationId) {
  this.stationCount++;
  console.log('Station Count: '+this.stationCount);
  var station = new Station(stationId);
  this.stations[stationId] = station;

  return this.stations[station.stationId];
}



Stations.prototype.emitStationCommand = function(msg) {
  // add arduino board to station
  return this.stations[stationId].emitCommand(msg);
}

Stations.prototype.emitCommands = function(msg) {
  // add arduino board to station
  for (var stationId in this.stations) {
    var station = this.stations[stationId];
    station.emitCommand(msg);
  }
  return this.stations;
}

Stations.prototype.startGame = function() {
  // start the game for all Stations
  for (var stationId in this.stations) {
    var station = this.stations[stationId];
    console.log(station, stationId);
    station.startGame();
  }
  return this.stations;
}

Stations.prototype.removeStation = function(stationId) {
  delete this.stations[stationId];
}

Stations.prototype.getStation = function(stationId) {
  return this.stations[stationId];
}

Stations.prototype.getStationName = function(stationId) {
  return this.stations[stationId] ? this.stations[stationId].name : '';
}

Stations.prototype.getStationPoints = function(stationId) {
  return this.stations[stationId] ? this.stations[stationId].points : -1;
}

Stations.prototype.addStationPoints = function(stationId, points) {
  if (!this.stations[stationId]) {
    return -1;
  }
  this.stations[stationId].points += points;
  this.stations[stationId].lastWinTime = new Date().getTime();
  return this.getStationPoints(stationId);
}

Stations.prototype.lastActive = function(stationId) {
  if (!this.stations[stationId]) {
    return false;
  }
  this.stations[stationId].lastActiveTime = new Date().getTime();
  return this.stations[stationId];
}

Stations.prototype.getStationCount = function() {
  return this.stationCount;
}

module.exports = Stations();