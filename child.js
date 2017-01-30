#!/usr/bin/env node
'use strict';

const { levels } = require('pino');
const split = require('split2');
const through = require('through2');
const pump = require('pump');
const json_parse = require('fast-json-parse');

//
// parse command line argument JSON
//
const { err, value: streams_cfg } = json_parse(process.argv[2]);
if (err)
    throw err;

//
// call user-provided stream functions to init external streams
//
const external = streams_cfg.map(({ stream, level }) => {
    if (typeof level == 'string')
        level = levels.values[level];
    else
        level = level || 0;

    return {
        stream: eval(`(${stream})()`),
        level: level
    };
});

//
// Parse incoming Pino logs as JSON, and then write to external streams (or
// don't if the log level is less than defined for the stream).
//
// Transport setup based on
//     https://github.com/pinojs/pino/blob/master/docs/transports.md
//
const n_streams = external.length;
const transport = through.obj(function (line, enc, cb) {
    const { value } = json_parse(line);
    for (let i = 0; i < n_streams; i++) {
        const { stream, level } = external[i];
        if (!stream._writableState.objectMode) {
            // Write raw line (+newline) if stream is not an object-mode stream.
            // Also write any lines that we could not parse as JSON.
            if (!value || value.level >= level)
                stream.write(line + '\n');
        } else if (value && value.level >= level) {
            stream.write(value);
        }
    }
    cb();
});

pump(process.stdin, split(), transport);
