import { format } from "util";
import * as path from "path";

import { LoggerFactory } from "./logger";
import * as rxUtils from "./rx-utils";
import { RxGoogleAPI } from "./rx-google-api";
import { catchError, map, flatMap } from "rxjs/operators";
import { Observable } from "rxjs";

const LISTING_BATCHE_SIZE = 1;

export default (loggerFactory: LoggerFactory, rxGapi: RxGoogleAPI) => {
    const logger = loggerFactory("index");

    // Load client secrets from a local file.
    return rxUtils.readTextFile(path.join(process.env.HOME, "kees", "nodejs-google-drive-credentials.json"))
    .pipe(
        catchError(err => {
            logger.error(`Error loading client secret file: ${err}`);
            return Observable.throw(err);
        }),
        // Authorize a client with credentials, then call the Google Drive API.
        flatMap(credentials => rxGapi.authorize(JSON.parse(credentials))),
        flatMap(oAuth2Client => rxGapi.listDriveFilesAll(oAuth2Client, LISTING_BATCHE_SIZE)),
        map(file => logger.info(format("file: %O", file)))
    );

};
