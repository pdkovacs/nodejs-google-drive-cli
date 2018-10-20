import { format } from "util";
import * as path from "path";
import * as fs from "fs";
import * as readline from "readline";
import { Observable, bindNodeCallback, Observer, bindCallback } from "rxjs";
import { map, flatMap, tap, mapTo } from "rxjs/operators";

import { drive_v3, google } from "googleapis";
import { OAuth2Client, Credentials } from "google-auth-library";
import { LoggerFactory } from "./logger";

// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/drive.metadata.readonly"];
const TOKEN_PATH = path.join(process.env.HOME, ".nodejs-drive-cli", "token.json");

const fileExists = bindCallback(fs.exists);

const readFileUTF8: (pathToFile: string, callback: (err: NodeJS.ErrnoException, data: string) => void) => void
= (pathToFile, callback) => fs.readFile(pathToFile, "utf8", callback);

const readTextFile = bindNodeCallback(readFileUTF8);

const writeTextFile = (filePath: string, content: string) => Observable.create((observer: Observer<void>) => {
    fs.writeFile(filePath, content, { encoding: "utf-8"}, err => {
        if (err) {
            observer.error(err);
        } else {
            observer.next(void 0);
            observer.complete();
        }
    });
});

interface InstalledCredentials {
    client_secret: string;
    client_id: string;
    redirect_uris: string;
}

interface ClientCredentials {
    installed: InstalledCredentials;
}

const getAccessToken: (loggerFactory: LoggerFactory, oAuth2Client: OAuth2Client) => Observable<Credentials>
= (loggerFactory, oAuth2Client) => Observable.create((observer: Observer<Credentials>) => {
    const logger = loggerFactory("get-access-token");
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES
    });
    logger.info(`Authorize this app by visiting this url: ${authUrl}`);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question("Enter the code from that page here: ", (code: string) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) {
                logger.error(`Error retrieving access token: ${err}`);
                observer.error(err);
            } else {
                observer.next(token);
                observer.complete();
            }
        });
    });
});

export interface RxUtils {
    fileExists: (pathToFile: string) => Observable<boolean>;
    readTextFile: (pathToFile: string) => Observable<string>;
    authorize: (clientCredentials: ClientCredentials) => Observable<OAuth2Client>;
    rxDrive$Files$List: (auth: OAuth2Client, pageSize: number) => Observable<drive_v3.Schema$File>;
}

const rxUtils: (loggerFactory: LoggerFactory) => RxUtils
= loggerFactory => ({

    fileExists,

    readTextFile,

    authorize: clientCredentials => {
        const logger = loggerFactory("authorize");
        const { client_secret, client_id, redirect_uris } = clientCredentials.installed;
        const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
        return fileExists(TOKEN_PATH)
        .pipe(
            flatMap(exists => exists
                ? readTextFile(TOKEN_PATH)
                : getAccessToken(loggerFactory, oAuth2Client)
                    .pipe(
                        map(token => JSON.stringify(token)),
                        flatMap(token => writeTextFile(TOKEN_PATH, token)
                            .pipe(
                                tap(() => logger.info(`Token stored to ${TOKEN_PATH}`)),
                                mapTo(token)
                            ))
                    )
            ),
            map(token => {
                oAuth2Client.setCredentials(JSON.parse(token));
                return oAuth2Client;
            })
        );
    },

    rxDrive$Files$List: (auth, pageSize) => Observable.create((observer: Observer<drive_v3.Schema$File>) => {
        const logger = loggerFactory("rxDrive$Files$List");
        logger.debug(format(">>>> auth: %O", auth));
        const drive = google.drive({version: "v3", auth});
        drive.files.list({
            pageSize
        }, (err, res) => {
            if (err) {
                logger.error(`The API returned an error: ${err}`);
                observer.error(err);
            }
            const files = res.data.files;
            if (files.length) {
                logger.info("Files:");
                files.forEach(file => {
                    logger.info(`${file.name} (${file.id})`);
                    observer.next(file);
                });
            } else {
                logger.info("No files found.");
            }
            observer.complete();
        });

    })

});

export default rxUtils;
