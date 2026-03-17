const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const env = require('../config/env');

dayjs.extend(utc);
dayjs.extend(timezone);

const tz = env.app.timezone;

module.exports = {
  now() {
    return dayjs().tz(tz);
  },
  format(date, formatStr = 'YYYY-MM-DD HH:mm:ss') {
    return dayjs(date).tz(tz).format(formatStr);
  },
};
