#!/usr/bin/env node
'use strict';

const { Stream } = require('stream');
const { levels } = require('pino');
const split = require('split2');
const through = require('through2');
const pump = require('pump');
const json_parse = require('fast-json-parse');
const LRU = require('lru-cache');

//
// parse command line argument JSON
//
const { err, value: streams_cfg } = json_parse(process.argv[2]);
if (err)
    throw err;

//
// call user-provided stream functions to init external streams
//
const write_to_stream = streams_cfg.map(({ stream, level, dedupe_minutes }) => {
    // convert named levels to numbers
    if (typeof level == 'string')
        level = levels.values[level];
    else
        level = level || 0;

    // create log cache so we may know if log entries with exactly the same
    // content have occurred before (only if "dedupe_minutes" option is set)
    let log_cache;
    if (Number.isFinite(dedupe_minutes) && dedupe_minutes > 0) {
        log_cache = LRU({
            max: 1000,
            maxAge: dedupe_minutes * 60 * 1000
        });
    }

    function is_dupe(line) {
        // not a dupe if dupe detection is not enabled
        if (!log_cache)
            return false;

        //
        // Cut out the
        //
        //    "time":XXXXXXXXX,
        //
        // portion of the log entry string because the time will pretty much
        // always differ and so must be removed for the dupe check. Cutting it
        // out of the raw string this way is a bit hackish, but since we don't
        // care about potential key order changes, this way we avoid messing
        // with objects and re-stringifying them.
        //
        const time_index = line.indexOf('"time":');
        const comma_index = line.indexOf(',', time_index);
        const key = line.substr(0, time_index) + line.substr(comma_index + 1);

        if (log_cache.has(key))
            return true;    // dupe detected

        log_cache.set(key, true);
        return false;
    }

    // eval user function to produce the stream
    const pino_stream = eval(`(${stream})()`);

    // different write function for each type of stream
    if (pino_stream instanceof Stream) {
        if (pino_stream._writableState.objectMode) {
            // handle object mode streams
            return function (line, obj) {
                if (obj && obj.level >= level && !is_dupe(line))
                    pino_stream.write(obj);
            }
        }

        // Stream is not an object-mode stream: write raw line (+newline). Also
        // write any lines that we could not parse as JSON.
        return function (line, obj) {
            if (!obj || obj.level >= level && !is_dupe(line))
                pino_stream.write(line + '\n');
        }
    }
    if (typeof pino_stream.write == 'function') {
        // handle "raw" bunyan-type streams (same as object-mode streams)
        return function (line, obj) {
            if (obj && obj.level >= level && !is_dupe(line))
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
