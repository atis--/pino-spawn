#!/usr/bin/env node
'use strict';

const { Stream } = require('stream');
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
const write_to_stream = streams_cfg.map(({ stream, level }) => {
    if (typeof level == 'string')
        level = levels.values[level];
    else
        level = level || 0;

    // eval user function to produce the stream
    const pino_stream = eval(`(${stream})()`);

    // different write function for each type of stream
    if (pino_stream instanceof Stream) {
        if (pino_stream._writableState.objectMode) {
            // handle object mode streams
            return function (line, obj) {
                if (obj && obj.level >= level)
                    pino_stream.write(obj);
            }
        }

        // Stream is not an object-mode stream: write raw line (+newline). Also
        // write any lines that we could not parse as JSON.
        return function (line, obj) {
            if (!obj || obj.level >= level)
                pino_stream.write(line + '\n');
        }
    }
    if (typeof pino_stream.write == 'function') {
        // handle "raw" bunyan-type streams (same as object-mode streams)
        return function (line, obj) {
            if (obj && obj.level >= level)
                pino_stream.write(obj);
        }
    }
    throw new Error('unsupported pino-spawn stream');
});

//
// Parse incoming Pino logs as JSON, and then write to external streams (or
// don't if the log level is less than defined for the stream).
//
// Transport setup based on
//     https://github.com/pinojs/pino/blob/master/docs/transports.md
//
const n_streams = write_to_stream.length;
const transport = through.obj(function (line, enc, cb) {
    const { value } = json_parse(line);
    for (let i = 0; i < n_streams; i++)
        write_to_stream[i](line, value);

    cb();
});

pump(process.stdin, split(), transport);
