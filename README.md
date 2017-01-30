# pino-spawn

* [About](#about)
* [Install](#install)
* [Usage](#usage)
* [License](#license)


## About

*pino-spawn* is a [pino][pino] utility (stream wrapper) that spawns a child
process and pipes all pino logs into it. The child will then parse the logs, and
distribute them to some external streams of your choice. The logs may be
filtered based on their level.

You can use the same stream config as for [Bunyan][bunyan-streams], but each
`stream` must be wrapped in a function that ends up being stringified and passed
to the child process to execute. Because they are executed in another process,
the functions should not be accessing any variables outside of their own scope.


## Install

```
# basic install
npm install --save pino pino-spawn

# install dependencies for the example below
npm install --save bunyan-slack modern-syslog
```


## Usage

```
const pino = require('pino');
const pino_spawn = require('pino-spawn');

const pino_out = pino_spawn({
    streams: [
        {
            stream: () => process.stdout,
            level: 'trace'
        },
        {
            stream: function () {
                return new require('bunyan-slack')({
                    webhook_url: "your_webhook_url",
                    channel: "#your_channel",
                    username: "your_username",
                })
            },
            level: 'warn'
        },
        {
            stream: function () {
                const syslog = require('modern-syslog');
                return syslog.Stream(syslog.LOG_ERR, syslog.LOG_USER);
            },
            level: 'error'
        }
    ]
});

const log = pino({
    name: process.title,
    level: 'trace'
}, pino_out);

log.info('Hello, world!');
log.warn('Hello, slack!');
log.error('Hello, slack & syslog!');

```


## License

Licensed under [MIT](./LICENSE).


[pino]: https://github.com/pinojs/pino
[bunyan-streams]: https://github.com/trentm/node-bunyan#streams
