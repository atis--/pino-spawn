'use strict';

const { spawn } = require('child_process');
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

        child_args.push([stream_name, level]);
    }

    // spawn child script
    const child = spawn(`${__dirname}/child.js`, child_args);

    // if user stream is not given, then simply return the child stream
    if (!user_stream)
        return child.stdin;

    // let Pino output go to both the user's stream and spawned child
    const out_stream = new PassThrough();
    out_stream.pipe(user_stream);
    out_stream.pipe(child.stdin);

    return out_stream;
}
