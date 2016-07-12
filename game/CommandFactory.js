MAX_STEPS = 7;
var gameSteps = [
  {'id':1, 'location':'Fuel Control', 'command':'Fuel Cell Error!', 'on':32, 'flashAfter':32, 'input':1, 'hint':'Must Clear Fuel Cells 1, and 5 Only', 'buffer':1, 'time':11, 'success': 'Fuel Cells Clear', 'failure': 'Failed to clear Fuel Cells!'},

  {'id':2, 'location':'Fuel Control', 'command':'Hydrogen Pressure Low', 'flashOn':25, 'input':2, 'hint':'Increase Hydrogen Pressure', 'buffer':6, 'time':20, 'success': 'Hydrogen Pressure at Maximum', 'failure': 'Failed to Increase Hydrogen Pressure'},

  {'id':9, 'location':'Launch Engineer', 'command':'Internal Power Not Transferred From Buss B', 'on':null, 'input':4, 'hint':'Transfer Power From Buss B Only', 'buffer':2, 'time':12, 'success': 'Internal Power Transfer Complete', 'failure': 'Internal Power failure on Buss B'},

  {'id':10, 'location':'Launch Engineer', 'command':'Release Swing Arm', 'flashOn':26, 'input':5, 'hint':'Swing Arm Must Be Released', 'buffer':5, 'time':15, 'success': 'Swing Arm Released', 'failure': 'Failed to release Swing Arm'},

  {'id':3, 'location':'Guidance', 'command':'Guidance Control #2 Did Not Release', 'input':7, 'hint':'Manually Release Guidance Control #2', 'buffer':5, 'time':15, 'success': 'Guidance Control Released', 'failure': 'Failed to Release Guidance Control'},

  {'id':11, 'location':'Guidance', 'command':'Primary Gyroscope Not Responding', 'flashOn':27, 'input':8, 'hint':'Increase Gyroscope Speed', 'buffer':5, 'time':10, 'success': 'Primary Gyroscope Responsive', 'failure': 'Gyroscope Failure'},
  {'id':12, 'location':'Fuel Control', 'command':'Fuel Cell Pressure building', 'on':32, 'flashAfter':32, 'input':13, 'hint':'Clear Fuel Cell 4 Immediately', 'buffer':5, 'time':10, 'success': 'Fuel Cells Clear', 'failure': 'Fuel Cell 4 Damaged'},
  {'id':13, 'location':'Guidance Systems', 'command':'Danger! Guidance control 6 is unstable.', 'input':14, 'hint':'Release Guidance Control 6 Now', 'buffer':5, 'time':10, 'success': 'Guidance stable', 'failure': 'Guidance Control 6 Damaged'},
  // {'id':17, 'location':'Launch Engineer', 'command':'Internal Power problem -- diagnosing now', 'on':32, 'flashAfter':32, 'input':11, 'hint':'Transfer Power from Buss E Immediately!', 'buffer':8, 'time':16, 'success': 'Power Stable', 'failure': 'Power Buss E Failing.'},
  
]

var constants = [
  {'id':0, 'location':'Commander', 'success':'Shuttle Launch in T-40 Seconds!', 'on':[25, 26, 27], 'input':null, 'buffer': 5},

  {'id':4, 'location':'Launch Engineer', 'command': 'Stand By For Booster Ignition Sequence', 'flashAfter':29, 'input':6, 'buffer': 5, 'time':12, 'hint':['Booster Ignition One GO!','Two GO!', 'Three GO!', 'Four GO!', 'Five GO!', 'Six GO!'], 'success': 'Ignition Sequence Successful', 'failure': 'Booster Ignition Failed'},

  {'id':5, 'location':'Commander', 'command':'Stand By To Launch', 'on':31, 'input':10, 'hint':'Launch Now!', 'buffer':5, 'time':7, 'success': 'Launch Successful', 'failure': 'Failed to Launch'},
  {'id':6, 'location':'Guidance', 'command':'Stand By for Rollover Sequence', 'on':28, 'flashAfter':30, 'input':9, 'hint':['Rollover Sequence "A" GO!','"B" GO!', '"C" GO!', '"D" GO!', 'E" GO!', '"F" GO!'], 'buffer':5, 'time':13, 'success': 'Rollover Successful', 'failure': 'Rollover Sequence Failed'}, // after we need to fire 31 of
  {'id':7, 'location':'Fuel Control', 'command':'Booster Shutdown Did Not Complete for L3', 'on':27, 'off':31, 'input':3, 'hint':'Manually Release Booster L3 Only', 'buffer':5, 'time':12, 'success': 'Booster Shutdown Complete', 'failure': 'Booster L3 Failed'},
  {'id':8, 'location':'Commander', 'success':'Getting some shimmy -- Standby for Power Down', 'on':32, 'input':null, 'buffer':5},
  // {'id':14, 'location':'Fuel Control', 'command':'Prime the Booster Pump', 'input':11, 'hint':'Manually Shut Down Booster R1!', 'buffer':2, 'time':7, 'success': 'Booster Shutdown R1 is Complete', 'failure': 'Booster Critically Unstable.'},
  {'id':15, 'location':'Commander', 'success': 'Shuttle Approaching Apogee'},
  {'id':16, 'location':'Commander', 'success': 'Shuttle Is Now In Orbit. Congratulations!'},
]
var gameOrder = [1, 4, 5, 3, 0, 2];
var RANDOM = true;

function CommandFactory() {
  if ( !(this instanceof CommandFactory) ) {
    return new CommandFactory();
  }
  this.init();
}

CommandFactory.prototype.init = function() {
  this.commands = [];
}

function getRandomIntArray(ri) {
  var eyes = [];
  while (eyes.length < gameSteps.length){
    var rn = Math.floor(Math.random()*gameSteps.length)
    var present = false;
    for (var i=0; i<eyes.length; i++) {
      if(eyes[i]==rn) { present = true; break }
    }
    if(!present) {
      eyes[eyes.length] = rn;
    }

  }
  return eyes;
}

CommandFactory.prototype.getCommands = function() {
  _this = this;
  // Get a unique random index
  var randArray = getRandomIntArray();
  for (var i = 0; i < MAX_STEPS; i++) {
    var command = {};

    if (!RANDOM) {

      command = new Command(gameSteps[gameOrder[i]]);

    } else {

      command = new Command(gameSteps[randArray[i]]);

    }
    _this.commands.push(command);
  };

  // After we have a random array, lets make sure our constants are in the right spot.
  for (var g = 0; g < constants.length; g++) {

    _this.commands.splice(constants[g].id, 0, new Command(constants[g]));
  };
  
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

  this.flashOn = data.flashOn ? data.flashOn : null;

  this.toggle = data.toggle ? data.toggle : null;

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

Command.prototype.deactivate = function() {
  this.active = false;
  return this;
}

// Create a timer that will self destruct without external interference
Command.prototype.setFailTimer = function(func) {

  var failMs = this.time * 1000;
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