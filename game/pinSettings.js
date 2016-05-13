var pinSettings = [
  { 
    pin: 0,
    voltage: 500,
    trigger: 'Default',
    voltageTrigger: 'min', // min readings should register a minimum of the voltage, so vRead >= voltage.
    lastReading: 500,
  },
  { 
    pin: 1,
    voltage: 500,
    trigger: 'Fuel Cell 5',
    voltageTrigger: 'min', // min readings should register a minimum of the voltage, so vRead >= voltage.
    lastReading: 500,
  },
  { 
    pin: 2,
    voltage: 500,
    trigger: 'Increase Hydrogen Pressure',
    voltageTrigger: 'min', 
    lastReading: 500,
  },
  { 
    pin: 3,
    voltage: 500,
    trigger: 'Booster L3',
    voltageTrigger: 'min',
    lastReading: 500,
  },
  { 
    pin: 4,
    voltage: 500,
    trigger: 'Buss B',
    voltageTrigger: 'min',
    lastReading: 500,
  },
  { 
    pin: 5,
    voltage: 500,
    trigger: 'Release Swing Arm',
    voltageTrigger: 'min',
    lastReading: 500,
  },
  { 
    pin: 6,
    voltage: 500,
    trigger: 'Booster Ignition',
    voltageTrigger: 'min',
    lastReading: 500,
  },
  { 
    pin: 7,
    voltage: 500,
    trigger: 'Guidance Control #2',
    voltageTrigger: 'min',
    lastReading: 500,
  },
  { 
    pin: 8,
    voltage: 500,
    trigger: 'Gyroscope',
    voltageTrigger: 'min',
    lastReading: 500,
  },
  { 
    pin: 9,
    voltage: 500,
    trigger: 'Rollover Sequence',
    voltageTrigger: 'min',
    lastReading: 500,
  },
  { 
    pin: 10,
    voltage: 500,
    trigger: 'Launch Button',
    voltageTrigger: 'max',
    lastReading: 1001
  },
  { 
    pin: 11,
    voltage: 500,
    trigger: 'Failure Pins',
    voltageTrigger: 'min',
    lastReading: 500,
  },
  { 
    pin: 13,
    voltage: 500,
    trigger: 'Fuel Cell 4',
    voltageTrigger: 'min',
  },
  { 
    pin: 14,
    voltage: 500,
    trigger: 'Release Guidance 6',
    voltageTrigger: 'min',
  }
]

module.exports = pinSettings;