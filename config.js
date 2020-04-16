import fs from 'fs';

import defaultConfig from './default-config.js';

const configLocation = '/etc/geike/geike.conf';

export function loadConfig() {
  if (fs.existsSync(configLocation)) {
    const configFile = fs.readFileSync(configLocation, { encoding: 'UTF-8' });
    return JSON.parse(configFile);
  } else {
    fs.writeFile(configLocation, JSON.stringify(defaultConfig), {encoding: 'UTF-8'}, err => {
      if (err) console.log('Unable to save default config: ' + err);
      else console.log('Saved default config');
    });

    return defaultConfig;
  }
}

export function storeConfig(config, logger) {
  if (logger) logger.log(`Saving config file at ${configLocation}`);

  const fd = fs.openSync(configLocation, 'w', 0o600);
  fs.writeSync(fd, JSON.stringify(config));
  fs.fdatasyncSync(fd);
  fs.closeSync(fd);
}
