'use strict';

const { levels } = require('pino');
const { spawn } = require('child_process');

module.exports = function (cfg) {
    // validate config
    if (!cfg || typeof cfg != 'object' || !Array.isArray(cfg.streams))
        throw new Error('missing pino-spawn stream configuration');

    // validate each stream config
    cfg.streams.forEach(function (stream_cfg) {
        const { stream, level } = stream_cfg;
        if (!stream || typeof stream != 'function')
            throw new Error('all pino-spawn streams must be wrapped in a function');

        if (typeof level == 'number' && !isFinite(level) || level < 0)
            throw new Error('invalid pino stream level');

        if (typeof level == 'string' && !(level in levels.values))
            throw new Error('invalid pino stream level name');
    });

    // stringify config along with the functions
    const child_arg = JSON.stringify(cfg.streams, (key, value) => {
        return typeof value == 'function' ? value.toString() : value;
    });

    // write fatal errors to stderr
    const fatal = function (msg, err) {
        console.error(msg, err);
    }

    // spawn child script, handle errors
    const child = spawn(`${__dirname}/child.js`, [ child_arg ], {
        stdio: ['pipe', process.stdout, process.stderr]
    });
    child.on('exit', (code, signal) => {
        fatal(`pino-spawn child exited with code ${code} and signal ${signal}`);
    });
    child.on('error', err => {
        fatal('pino-spawn child error', err);
    });
    child.stdin.on('error', err => {
        fatal('pino-spawn child stdin error', err);
    });

    // let child die on parent exit
    child.unref();
    child.stdin.unref();

    // return the child's stdin
    return child.stdin;
}
