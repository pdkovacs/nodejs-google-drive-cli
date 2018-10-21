import * as fs from "fs";
import { Observable, bindNodeCallback, Observer, bindCallback } from "rxjs";

export const fileExists = bindCallback(fs.exists);

const readFileUTF8: (pathToFile: string, callback: (err: NodeJS.ErrnoException, data: string) => void) => void
= (pathToFile, callback) => fs.readFile(pathToFile, "utf8", callback);

export const readTextFile = bindNodeCallback(readFileUTF8);

export const writeTextFile = (filePath: string, content: string) => Observable.create((observer: Observer<void>) => {
    fs.writeFile(filePath, content, { encoding: "utf-8"}, err => {
        if (err) {
            observer.error(err);
        } else {
            observer.next(void 0);
            observer.complete();
        }
    });
});
