'use strict';

const { stdSerializers } = require('pino');
const { spawn } = require('child_process');
const { hostname } = require('os');
const { Stream, PassThrough } = require('stream');

module.exports = function (user_stream, external_stream_cfg) {
    if (user_stream && !(user_stream instanceof Stream))
        throw new Error(`value passed to pino-spawn is not a Stream`);

    // prepare args for spawned child
    const child_args = [];
    for (const stream_name in external_stream_cfg) {
        const level = external_stream_cfg[stream_name];

        // validate level
        if (!Number.isInteger(level) || level <= 0) {
            throw new Error(`expected non-negative integer as level, `+
                            `got "${level}"`);
        }

        child_args.push(stream_name, level);
    }

    // write fatal errors to user's stream if possible; otherwise stderr
    const fatal = function (msg, err) {
        if (user_stream) {
            try {
                user_stream.write(JSON.stringify({
                    v: 1,
                    msg: msg,
                    err: err ? stdSerializers.err(err) : undefined,
                    level: 60,
                    time: Date.now(),
                    pid: process.pid,
                    name: process.title,
                    hostname: hostname()
                }));
            } catch (_) {
                console.error(msg, err);
            }
        } else {
            console.error(msg, err);
        }
    }

    // spawn child script, handle errors
    const child = spawn(`${__dirname}/child.js`, child_args, {
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

    // if user stream is not given, then simply return the child stream
    if (!user_stream)
        return child.stdin;

    // let Pino output go to both the user's stream and spawned child
    const out_stream = new PassThrough();
    out_stream.pipe(user_stream);
    out_stream.pipe(child.stdin);

    return out_stream;
}
