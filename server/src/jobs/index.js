const { Queue } = require('bullmq');
const env = require('../config/env');

const connection = env.redis.url;

const jobQueue = new Queue('inventory-jobs', { connection });

module.exports = jobQueue;
