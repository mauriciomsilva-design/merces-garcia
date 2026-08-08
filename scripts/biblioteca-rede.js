const express = require('express');
const originalListen = express.application.listen;
express.application.listen = function(port, host, ...args) {
  return originalListen.call(this, port, process.env.BIBLIOTECA_HOST || '0.0.0.0', ...args);
};
require('../biblioteca/server');
