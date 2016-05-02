var gameSteps = [
  {'id':1, 'location':'Fuel Control', 'command':'Fuel Cell Error!', 'on':32, 'off':[29, 30], 'input':1, 'hint':'Must Clear Fuel Cells 1, 4, and 5 Only', 'buffer':1, 'time':11, 'success': 'Fuel Cells Clear', 'failure': 'Failed to clear Fuel Cells!'},

  {'id':2, 'location':'Fuel Control', 'command':'Hydrogen Pressure Low', 'on':25, 'input':2, 'hint':'Increase Hydrogen Pressure', 'buffer':6, 'time':20, 'success': 'Hydrogen Pressure at Maximum', 'failure': 'Failed to Increase Hydrogen Pressure'},

  {'id':3, 'location':'Fuel Control', 'command':'Booster Shutdown Did Not Complete for L3', 'on':27, 'input':3, 'hint':'Manually Release Booster L3 Only', 'buffer':5, 'time':15, 'success': 'Booster Shutdown Complete', 'failure': 'Booster L3 Failed'},

  {'id':4, 'location':'Launch Engineer', 'command':'Internal Power Has Not Transferred From Buss B', 'on':null, 'input':4, 'hint':'Manually Transfer Power From Buss B Only', 'buffer':2, 'time':12, 'success': 'Internal Power Transfer Complete', 'failure': 'Internal Power failure on Buss B'},

  {'id':10, 'location':'Launch Engineer', 'command':'Release Swing Arm', 'on':26, 'input':5, 'hint':'Swing Arm must be released', 'buffer':5, 'time':15, 'success': 'Swing Arm Released', 'failure': 'Failed to release Swing Arm'},

  {'id':7, 'location':'Guidance', 'command':'Guidance Control #2 Did Not Release', 'on':26, 'input':7, 'hint':'Manually Release Guidance Control #2', 'buffer':5, 'time':15, 'success': 'Guidance Control Released', 'failure': 'Failed to Release Guidance Control'},

  {'id':8, 'location':'Guidance', 'command':'Primary Gyroscope Not Responding', 'on':27, 'input':8, 'hint':'Increase Gyroscope Speed', 'buffer':5, 'time':20, 'success': 'Primary Gyroscope Responsive', 'failure': 'Gyroscope Failure'},

  {'id':9, 'location':'Guidance', 'command':'Stand By for Rollover Sequence', 'on':30, 'input':9, 'hint':['Rollover Sequence "A" GO!','"B" GO!', '"C" GO!', '"D" GO!', 'E" GO!', '"F" GO!'], 'buffer':5, 'time':13, 'success': 'Rollover Successful', 'failure': 'Rollover Sequence Failed'}, // after we need to fire 31 of
  
]

var constants = [
  {'id':0, 'success':'Shuttle Launch in T-40 Seconds!', 'on':[25, 26, 27, 29, 30, 32], 'input':null},

  {'id':5, 'location':'Launch Engineer', 'command': 'Stand By For Booster Ignition Sequence', 'on':29, 'input':6, 'buffer': 5, 'time':15, 'hint':['Booster Ignition One GO!','Two GO!', 'Three GO!', 'Four GO!', 'Five GO!', 'Six GO!'], 'success': 'Ignition Sequence Successful', 'failure': 'Booster Ignition Failed'},

  {'id':6, 'location':'Commander', 'command':'Stand By To Launch', 'on':29, 'input':10, 'hint':'Launch Now!', 'buffer':5, 'time':7, 'success': 'Launch Successful', 'failure': 'Failed to Launch'}, // before we need to fire 31 and after we need to fire 28
  {'id':11, 'command': 'Shuttle Approaching Apogee', 'off':[25, 26, 27, 28, 29, 30, 32], 'hint':'Space Shuttle Is Now In Orbit. Congratulations!', 'buffer':5, 'time':6, 'success': 'Launch Sequence Successful'},
]
var gameOrder = [1, 4, 5, 2, 6, 3, 0, 7];
var RANDOM = false;
var eyes = [];

function CommandFactory() {
  if ( !(this instanceof CommandFactory) ) {
    return new CommandFactory();
  }
  this.init();
}

CommandFactory.prototype.init = function() {
  this.commands = [];
}

function getRandomInt() {
  var RandI = Math.floor(Math.random() * gameSteps.length);
  if (eyes.indexOf(RandI) == -1) {
    eyes.push(RandI);
    return RandI;
  } else {
    getRandomInt();
  }
}

CommandFactory.prototype.getCommands = function() {
  _this = this;
  for (var i = 0; i < gameOrder.length; i++) {
    var command = {};

    if (!RANDOM) {

      command = new Command(gameSteps[gameOrder[i]]);

    } else {

      // Get a unique random index
      var RandI = getRandomInt();

      command = new Command(gameSteps[RandI]);

    }
    _this.commands.push(command);
  };

  // After we have a random array, lets make sure our constants are in the right spot.
  for (var g = 0; g < constants.length; g++) {

    console.log("Constant step Id:"+constants[g].id);

    _this.commands.splice(constants[g].id, 0, new Command(constants[g]));
  };
  
  console.log(this.commands);
  return this.commands;
}

function Command(data) {
  if ( !(this instanceof Command) ) {
    return new Command(data);
  }
  this.init(data);
}

Command.prototype.init = function(data) {
  this.id = data.id; // * REQUIRED * 

  this.command = data.command; // * REQUIRED * Some text to be told to the commander 

  this.input = data.input ? data.input : null; // The pin we should be listening to

  this.location = data.location ? data.location : null; // Area of the panel

  this.on = data.on ? data.on : null; // Pins that should be turned on

  this.off = data.off ? data.off : null; // Pins that should be turned off

  this.hint = data.hint ? data.hint : data.command;

  this.success = data.success ? data.success : ''; // * REQUIRED * Success message

  this.failure = data.failure ? data.failure : ''; // * REQUIRED * Success message

  this.buffer = data.buffer ? data.buffer : 5; // Time before hint fires

  this.time = data.time ? data.time : 10; // Time allowed to complete this command

  this.failTimer = {};

  this.hintTimer = {};

  this.active = false; // switch on when registered in game
}

Command.prototype.setActive = function() {
  this.active = true;
  return this;
}

// Create a timer that will self destruct without external interference
Command.prototype.setFailTimer = function(func) {

  var failMs = this.time * 1000;
  debugger;
  this.failTimer = setTimeout(function() {
    func();
  }, failMs);
}

// Create a timer that will self destruct without external interference
Command.prototype.setHintTimer = function(func) {

  var failMs = this.buffer * 1000;

  this.hintTimer = setTimeout(function() {
    func();
  }, failMs);
}

Command.prototype.clearFailTimer = function() {
  return clearTimeout(this.failTimer);
}

Command.prototype.clearHintTimer = function() {
  return clearTimeout(this.hintTimer);
}

module.exports = CommandFactory;