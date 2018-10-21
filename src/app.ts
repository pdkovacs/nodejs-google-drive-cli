import { Logger } from "winston";
import { LoggerFactory, LoggerBaseFactory } from "./logger";

import rxGapi from "./rx-google-api";
import main from "./index";

const configuration = {
    logLevel: "debug"
};

const loggerFactory: LoggerFactory = LoggerBaseFactory(configuration.logLevel);

const logger: Logger = loggerFactory("app");
logger.info("Logger factory created");

main(loggerFactory, rxGapi(loggerFactory))
.subscribe(
    result => logger.info(`Application result: ${result}`),
    error => logger.error(error),
    void 0
);
