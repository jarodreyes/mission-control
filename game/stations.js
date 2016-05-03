var five = require("johnny-five");
var clientIo = require('socket.io-client');
var CommandFactory = require('./CommandFactory');
var arduino = require('./arduino');
var Player = require('player');

STATION_COUNT = 1;
DEFAULT_WAIT_TIME = 5000;
DEFAULT_INTERVAL = 7500;
PORTS = ["/dev/cu.usbmodem1421", "/dev/cu.usbmodem1411"];
TIMED = false;
FAILURES_ALLOWED = 6;
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
  this.player = {};
  this.playerFail = {};
  this.playerSuccess = {};
  this.failing = false;
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
  var acNum = activeCommands.length;
  var completed = station.getCompleted();
  while (pin == 11) {
    station.processFailure();
    return;
  }
  // if any Active commands are listening for this pin, do something
  for (var i = activeCommands.length - 1; i >= 0; i--) {
    console.log("Active Pin "+activeCommands[i].input);
    if (activeCommands[i].input == pin) {
      station.processSuccess(activeCommands[i]);
    } else {
      station.misses++;
      console.log('Missed!')
    }
  };
}

Station.prototype.beginCommandSequence = function(command) {
  var station = this;

  if(command.command != undefined) {
    this.emitCommand(command);
  } else {
    this.emitSuccess(command);
  }

  // No matter what we want to fire the next command soon
  while (command.input == null) {
    setTimeout(function() {
      station.completed++;
      station.nextCommand();
    }, DEFAULT_WAIT_TIME);
    return;
  }

  setTimeout(function() {
    station.nextCommand();
  }, DEFAULT_INTERVAL);

  // Set this command as active
  command.setActive();
  
  // Check for Failure
  command.setFailTimer(function() {
    station.processFailure(command);
  });

  command.setHintTimer(function() {
    station.emitHint(command)
  });
}

Station.prototype.nextCommand = function() {
  var command = this.currentCommand = this.commands[this.currentStep];

  while (this.failures >= FAILURES_ALLOWED) {
    this.removeStation();
    return;
  }
  if (this.currentStep == this.commands.length) {
    this.endGame();
  } else {
    this.currentStep++;
    this.beginCommandSequence(command);
  }
}

Station.prototype.processFailure = function(command) {
  var station = this;
  if (command != undefined) {
    this.emitFailure(command);
    command.deactivate();
  }
  this.completed++;
  this.failures++;

  console.log('This Failing?: '+this.failing);
  if (!this.failing) {
    this.playerFail.play(function( err, player) {
      console.log("Playing Ended! "+err);
      station.failing = false;
    });
  }
}

Station.prototype.processSuccess = function(command) {
  command.clearHintTimer();
  command.clearFailTimer();
  command.deactivate();
  this.completed++;
  this.points += 100;
  this.emitSuccess(command);
  this.socket.emit('success', {'station':this.id});
  this.playerSuccess.play(function( err, player) {
    console.log("Success Player Ended! "+err);
  });
}

Station.prototype.awaitingInput = function(actionStep) {
  return this.completed <= actionStep;
}

Station.prototype.emitSuccess = function(command) {
  var msg = command.success;
  var cId = command ? command.id : 0;
  this.emitStationMsg({'station':this.id, 'msg':msg, 'type':'success', 'cid': cId})
}

Station.prototype.emitFailure = function(command) {
  var msg = command.failure ? command.failure : command.location+': Failed!';
  var cId = command ? command.id : 0;
  this.emitStationMsg({'station':this.id, 'msg':msg, 'type':'failure', 'cid': cId})
}

Station.prototype.emitHint = function(command) {
  var cId = command ? command.id : 0;
  this.emitStationMsg({'station':this.id, 'msg':command.hint, 'type':'hint', 'cid': cId})
}

Station.prototype.emitCommand = function(command) {
  var cId = command ? command.id : 0;
  var timeLeft = command.time ? command.time : DEFAULT_WAIT_TIME/1000;
  this.emitStationMsg({'station':this.id, 'msg':command.command, 'type':'command', 'timeLeft':timeLeft, 'cid': cId})
}

Station.prototype.emitStationMsg = function(data) {
  this.socket.emit("command", data);
  console.log("Station Message: "+this.id+" "+data.msg);
  console.log("Station Stats - Completed:"+this.completed+" Current:"+this.currentStep+" Points:"+this.points+" Misse:"+this.misses);
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
      console.log('Getting Command: '+this.commands[i].id)
      return this.commands[i];
    }
  };
}

Station.prototype.getCurrentCommand = function() {
  return this.currentCommand;
}

Station.prototype.deactivateAllCommands = function() {
  for (var i = this.commands.length - 1; i >= 0; i--) {
    this.commands[i].deactivate();
    this.commands[i].clearFailTimer();
    this.commands[i].clearHintTimer();
  };
  return;
}

Station.prototype.getCompleted = function() {
  console.log("Completed: "+this.completed);
  return this.completed;
}

Station.prototype.startGame = function() {
  var CF = new CommandFactory();
  var station = this;

  this.commands = CF.getCommands();
  this.startAudio();
  // Emit the next command in the list
  this.nextCommand();
}

Station.prototype.startAudio = function() {
  var station = this;
  this.player = new Player(__dirname + '/launch.mp3');
  this.playerFail = new Player(__dirname + '/fail.mp3');
  this.playerSuccess = new Player(__dirname + '/success.mp3');
  this.playerLose = new Player(__dirname + '/lose.mp3');

  // play now and callback when playend
  this.player.play();

  this.player.on('playing',function(item){
    console.log('im playing... src:' + item);
  });
  this.player.on('error', function(err) {
    console.log('Player Error');
    console.log(err);
  });
  this.playerFail.on('error', function(err) {
    console.log('Player Error');
    console.log(err);
    station.failing = false;
  });
  this.playerFail.on('playing',function(item){
    station.failing = true;
  });
  this.playerSuccess.on('error', function(err) {
    console.log('Player Error');
    console.log(err);
  });
  this.playerLose.on('error', function(err) {
    console.log('Player Error');
    console.log(err);
  });
}

Station.prototype.removeStation = function() {
  var station = this;
  this.endSequences(function() {
    station.socket.emit('station_removed', {'station': station.id});
    station.playerLose.play();
  });
  console.log('Remove Station: '+ this.id);
}

Station.prototype.endGame = function() {
  var station = this;
  this.endSequences(function() {
    station.playerLose.play();
  });
  console.log('End Game');
  this.socket.emit('end_game', {'station': this.id, 'points':this.points, 'misses':this.misses});
}

Station.prototype.endSequences = function(callback) {
  this.player.stop();
  this.playerFail.stop();
  this.deactivateAllCommands();
  return callback();
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
    station.emitStationMsg(msg);
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

Stations.prototype.getScore = function() {
  // start the game for all Stations
  var pointStache = 0;
  var missed = 0;
  var winner = 0;
  var loser = 0;
  for (var stationId in this.stations) {
    var stationPoints = this.getStationPoints(stationId);
    var stationMissed = this.getStationMissed(stationId) + stationPoints;
    winner = stationPoints > pointStache ? stationId : winner;
    loser = (stationId > winner) && (stationPoints < pointStache) ? stationId : loser;
    pointStache = stationPoints > pointStache ? stationPoints : pointStache;
    missed = stationMissed < missed ? stationMissed : missed;
  }
  return {'winner':winner, 'loser':loser, 'points':pointStache};
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