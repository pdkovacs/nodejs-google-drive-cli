import * as path from "path";
import { Observable, Observer } from "rxjs";
import { flatMap, map, tap, mapTo } from "rxjs/operators";
import { OAuth2Client, Credentials } from "google-auth-library";
import { drive_v3, google } from "googleapis";
import * as readline from "readline";
import { LoggerFactory } from "./logger";
import { fileExists, readTextFile, writeTextFile } from "./rx-utils";

// If modifying these scopes, delete token.json.
const SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/drive.metadata",
    "https://www.googleapis.com/auth/drive.appdata",
    "https://www.googleapis.com/auth/drive.file"
];
const TOKEN_PATH = path.join(process.env.HOME, ".nodejs-drive-cli", "token.json");

interface InstalledCredentials {
    client_secret: string;
    client_id: string;
    redirect_uris: string;
}

interface ClientCredentials {
    installed: InstalledCredentials;
}

export interface RxGoogleAPI {
    authorize: (clientCredentials: ClientCredentials) => Observable<OAuth2Client>;
    listDriveFilesPageful: (auth: OAuth2Client, pageSize: number) => Observable<drive_v3.Schema$File>;
    listDriveFilesAll: (auth: OAuth2Client, pageSize: number) => Observable<drive_v3.Schema$File>;
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

const rxGoogleAPI: (loggerFactory: LoggerFactory) => RxGoogleAPI
= loggerFactory => {

    const listDriveFilesMaybeRecurse = (
        drive: drive_v3.Drive,
        pageToken: string,
        pageSize: number,
        recurse: boolean,
        observer: Observer<drive_v3.Schema$File>
    ) => {
        const logger = loggerFactory("rxDrive$Files$List");
        drive.files.list({
            pageToken,
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
            }

            const nextPageToken = res.data.nextPageToken;
            if (recurse && nextPageToken) {
                listDriveFilesMaybeRecurse(drive, nextPageToken, pageSize, recurse, observer);
            } else {
                observer.complete();
            }
        });
    };

    return {
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
        listDriveFilesAll: (auth, pageSize) => Observable.create((observer: Observer<drive_v3.Schema$File>) => {
            const drive = google.drive({version: "v3", auth});
            return listDriveFilesMaybeRecurse(drive, void 0, pageSize, true, observer);
        }),
        listDriveFilesPageful: (auth, pageSize) => Observable.create((observer: Observer<drive_v3.Schema$File>) => {
            const drive = google.drive({version: "v3", auth});
            return listDriveFilesMaybeRecurse(drive, void 0, pageSize, false, observer);
        })
    };
};

export default rxGoogleAPI;
