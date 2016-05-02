var five = require("johnny-five");
var clientIo = require('socket.io-client');
var CommandFactory = require('./CommandFactory');
var arduino = require('./arduino');
// var play = require('play').Play();

STATION_COUNT = 1;
DEFAULT_WAIT_TIME = 5000;
DEFAULT_INTERVAL = 7500;
PORTS = ["/dev/cu.usbmodem1421", "/dev/cu.usbmodem1411"];
TIMED = false;
FAILURES_ALLOWED = 10;
// console.log = function(){}

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
  console.log("Station Ready? "+this.ready);
  // When board is connected lets' connect this station
  arduino.connectBoard(station, this.board);
}

Station.prototype.checkInput = function(pin) {
  console.log("Pin Firing: "+pin);
  var station = this;
  var activeCommands = this.getActiveCommands();
  while (pin == 11) {
    station.emitFailure();
    return;
  }
  // if any Active commands are listening for this pin, do something
  for (var i = activeCommands.length - 1; i >= 0; i--) {
    if (activeCommands[i].input == pin) {
      activeCommands[i].clearHintTimer();
      activeCommands[i].clearFailTimer();
      if (station.getCompleted() < (station.currentStep - activeCommands.length)) {
        station.completed++;
        station.points += 100;
        station.emitCommand(activeCommands[i].success);
        station.socket.emit('success', {'station':station.id});
      }
    } else {
      station.misses++;
      console.log('Missed!')
    }
  };
}

Station.prototype.beginCommandSequence = function(command) {
  var nextCommandDelayMs = command.buffer * 1000;
  var timeToFixMs = command.time * 1000;
  var station = this;
  var actionStep = this.currentStep;

  // If there isn't a command associated with the command object, then it's probably a success message.
  var msg = command.command ? command.command : command.success;

  this.emitCommand(msg, null, command);

  // No matter what we want to fire the next command soon
  while (command.input == null) {
    setTimeout(function() {
      station.completed++;
      station.nextCommand('default');
    }, DEFAULT_WAIT_TIME);
    return;
  } 

  setTimeout(function() {
    station.nextCommand("bgs");
  }, DEFAULT_INTERVAL);

  // Set this command as active
  command.setActive();
  
  // Check for Failure
  command.setFailTimer(function() {
    station.emitFailure(command);
  });

  command.setHintTimer(function() {
    station.emitCommand(command.hint, null, command)
  });
}

Station.prototype.nextCommand = function(cmd) {
  console.log(cmd);
  var command = this.currentCommand = this.commands[this.currentStep];

  while (this.failures >= FAILURES_ALLOWED) {
    this.endGame();
    return;
  }
  this.currentStep++;

  this.beginCommandSequence(command);
}

Station.prototype.checkAnswer = function(actionStep, timeToFixMs) {
  var station = this;
  console.log("Awaiting Input?:"+this.awaitingInput(actionStep)+" ActStep"+actionStep);

  // If we do have an input, execute the hint first, than register a failure

  // Regardless we should fire a new command every 15 seconds.
  setTimeout(function() {
    
    if (station.awaitingInput(actionStep)) {
      station.emitFailure();
    }
  }, timeToFixMs);
}

Station.prototype.emitFailure = function(command) {
  this.emitCommand(''+command.location+': '+command.failure+'', null, command);
  this.completed++;
  this.failures++;
}

Station.prototype.awaitingInput = function(actionStep) {
  return this.completed <= actionStep;
}

Station.prototype.emitCommand = function(msg, type, command) {
  console.log("Emit Command"+msg);
  var type = type ? type : "success";
  var cId = command ? command.id : 0;
  var timeLeft = this.getCommand(cId).time ? this.getCommand(cId).time : DEFAULT_WAIT_TIME/1000;
  if (this.getCommand(cId).hint == msg) {
    type = 'hint';
  } else if (this.getCommand(cId).command == msg) {
    type = 'command';
  }

  this.socket.emit("command", {'station':this.id, 'msg':msg, 'type':type, 'timeLeft':timeLeft, 'cid': cId});
  console.log("Station Command: "+this.id+" "+msg);
  console.log("Station Stats - Completed:"+this.completed+" Current:"+this.currentStep+" Points:"+this.points);
}

Station.prototype.getActiveCommands = function() {
  var result = [];
  for (var i = this.commands.length - 1; i >= 0; i--) {
    if (this.commands[i].active) {
      result.push(this.commands[i])
    }
  };
  return result;
}

Station.prototype.getCommand = function(id) {
  for (var i = this.commands.length - 1; i >= 0; i--) {
    if (this.commands[i].id == id) {
      return this.commands[i];
    }
  };
}

Station.prototype.getCurrentCommand = function() {
  return this.currentCommand;
}

Station.prototype.getCompleted = function() {
  console.log("Completed: "+this.completed);
  return this.completed;
}

Station.prototype.startGame = function() {
  var CF = new CommandFactory();
  var station = this;

  this.commands = CF.getCommands();
  // play.on('play', function (valid) {
  //   console.log('I just started playing!');
  // });
  // play.sound('');

  // Emit the next command in the list
  this.nextCommand();
}

Station.prototype.endGame = function() {
  this.emitCommand('Station Removed from Cluster. Mission Failed!', null, this.getCurrentCommand());
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

Stations.prototype.resetGame = function() {
  this.stations = {};
  this.createStations();
  return this.stations;
}

Stations.prototype.startGame = function() {
  // start the game for all Stations
  for (var stationId in this.stations) {
    var station = this.stations[stationId];
    console.log("Station ID"+stationId);
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

Stations.prototype.getStationMissed = function(stationId) {
  return this.stations[stationId] ? this.stations[stationId].missed : '';
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