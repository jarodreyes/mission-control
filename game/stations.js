var five = require("johnny-five");
var clientIo = require('socket.io-client');
var CommandFactory = require('./CommandFactory');
var arduino = require('./arduino');
// var play = require('play').Play();

STATION_COUNT = 1;
DEFAULT_WAIT_TIME = 5000;
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
  while (pin == 11) {
    station.emitFailure();
    return;
  }
  if (this.getCurrentCommand().input == pin) {
    if (station.getCompleted() < station.currentStep) {
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
  var command = c.command ? c.command : c.success;
  var nextCommandDelayMs = c.buffer * 1000;
  var timeToFixMs = c.time * 1000;
  var station = this;
  var actionStep = this.currentStep;

  while (this.failures >= FAILURES_ALLOWED) {
    station.endGame();
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

  // If we don't have an input, just execute the wait time and execute the next command
  while (this.getCurrentCommand().input == null) {
    setTimeout(function() {
      station.completed++;
      station.nextCommand();
    }, DEFAULT_WAIT_TIME);
    return;
  }

  // If we do have an input, execute the hint first, than register a failure
  if (this.awaitingInput(actionStep)) {
    station.emitCommand(station.getCurrentCommand().hint);
    setTimeout(function() {
      console.log("The Score:" +station.points+ "- The Step:" +actionStep);
      if (station.awaitingInput(actionStep)) {
        station.emitFailure();
      }
    }, timeToFixMs);
  }

  // Regardless we should fire a new command every 15 seconds.
  setTimeout(function() {
    console.log("The Score:" +station.points+ "- The Step:" +actionStep);
    if (station.awaitingInput(actionStep)) {
      station.emitFailure();
    }
  }, timeToFixMs);
}

Station.prototype.emitFailure = function() {
  this.emitCommand('Failure!');
  this.completed++;
  this.failures++;
  this.nextCommand();
}

Station.prototype.awaitingInput = function(actionStep) {
  return this.completed <= actionStep;
}

Station.prototype.emitCommand = function(cmd, type) {
  var type = type ? type : "success";
  var timeLeft = this.getCurrentCommand().time ? this.getCurrentCommand().time : DEFAULT_WAIT_TIME/1000;
  if (this.getCurrentCommand().hint == cmd) {
    type = 'hint';
  } else if (this.getCurrentCommand().command == cmd) {
    type = 'command';
  }
  // this.socket.broadcast.emit("station"+this.id, cmd);
  this.socket.emit("command", {'station':this.id, 'msg':cmd, 'type':type, 'timeLeft':timeLeft});
  console.log("Station Command: "+this.id+" "+cmd);
  console.log("Station Stats - Completed:"+this.completed+" Current:"+this.currentStep+" Points:"+this.points);
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

  // setup listener for next_question
  this.socket.on("next_question", function(data) {
    console.log("Next Questions!");
    if (data.station == station.id) {
      clearTimeout(station.timer);
      station.nextCommand();
    }
  });
}

Station.prototype.endGame = function() {
  this.emitCommand('Station Removed from Cluster. Mission Failed!');
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