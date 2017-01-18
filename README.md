# pino-spawn

* [About](#about)
* [License](#license)


## About

*pino-spawn* is a [pino](pino) transport that spawns a child process and pipes
all pino logs into it (with the logs also going to your regular pino output
stream like *stdout*). The child will then parse the logs, and distribute it to
some external streams of your choice. Currently supported external streams:

* [modern-syslog](https://github.com/strongloop/modern-syslog)


## License

Licensed under [MIT](./LICENSE).
