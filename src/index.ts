import * as path from "path";

import { LoggerFactory } from "./logger";

import { RxUtils } from "./rx-utils";
import { catchError, map, flatMap, tap } from "rxjs/operators";
import { Observable } from "rxjs";

export default (loggerFactory: LoggerFactory, rxUtils: RxUtils) => {
    const logger = loggerFactory("index");

    // Load client secrets from a local file.
    return rxUtils.readTextFile(path.join(process.env.HOME, "kees", "nodejs-google-drive-credentials.json"))
    .pipe(
        catchError(err => {
            logger.error(`Error loading client secret file: ${err}`);
            return Observable.throw(err);
        }),
        // Authorize a client with credentials, then call the Google Drive API.
        flatMap(credentials => rxUtils.authorize(JSON.parse(credentials))),
        flatMap(oAuth2Client => rxUtils.rxDrive$Files$List(oAuth2Client, 7)),
        map(file => logger.info(`file: ${file}`))
    );

};
