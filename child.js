#!/usr/bin/env node
'use strict';

const { error } = console;
const { exit } = process;

const split = require('split2');
const through = require('through2');
const pump = require('pump');
const json_parse = require('fast-json-parse');

//
// must have even number of arguments
//
const args = process.argv.slice(2);
if (args.length % 2 == 1) {
    error('expected even number of arguments');
    error('usage: ./child.js stream-name level stream-name2 level2 ...');
    exit(1);
}

//
// create external streams based on arguments
//
const external = [];
for (let i = 0; i < args.length / 2; i++) {
    const stream_name = args[i*2];
    const level = +args[i*2 + 1];

    if (!Number.isInteger(level) || level <= 0) {
        error(`expected non-negative integer as level, got "${args[i*2 + 1]}"`);
        exit(1);
    }

    let stream;
    switch (stream_name) {
        case 'modern-syslog':
            const syslog = require('modern-syslog');
            stream = syslog.Stream(syslog.LOG_ERR, syslog.LOG_USER);
            break;
        default:
            error(`unknown external stream name "${stream_name}"`);
            exit(1);
    }

    external.push({ stream, level });
}

//
// Parse incoming Pino logs as JSON, and then write to external streams (or
// don't if the log level is less than defined for the stream).
//
// Transport setup based on
//     https://github.com/pinojs/pino/blob/master/docs/transports.md
//
const n_streams = external.length;
const transport = through.obj(function (chunk, enc, cb) {
    const { value } = json_parse(chunk);
    if (value) {
        for (let i = 0; i < n_streams; i++) {
            if (value && value.level >= external[i].level) 
                external[i].stream.write(chunk);
        }
    }
    cb();
});

pump(process.stdin, split(), transport);
