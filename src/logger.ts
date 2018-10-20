import * as winston from "winston";

export type LoggerFactory = (label: string) => winston.Logger;

export const LoggerBaseFactory: (logLevel: string) => LoggerFactory
= logLevel => label => winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.label({label}),
        winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
    transports: [ new winston.transports.Console() ]
});
