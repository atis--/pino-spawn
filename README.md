# pino-spawn

* [About](#about)
* [Install](#install)
* [Usage](#usage)
* [License](#license)


## About

*pino-spawn* is a [pino][pino] transport that spawns a child process and pipes
all pino logs into it (with the logs also going to your regular pino output
stream like *stdout*). The child will then parse the logs, and distribute it to
some external streams of your choice. The logs may be filtered based on their
level. Currently supported external streams:

* [modern-syslog](https://github.com/strongloop/modern-syslog)


## Install

```
npm install pino pino-spawn modern-syslog --save
```


## Usage

```
const pino = require('pino');
const pino_spawn = require('pino-spawn');

const pino_out = pino_spawn(process.stdout, { 'modern-syslog': 50 });

const log = pino({
    name: process.title,
    level: 'trace'
}, pino_out);

log.info('Hello, world!');

```


## License

Licensed under [MIT](./LICENSE).


[pino]: https://github.com/pinojs/pino
