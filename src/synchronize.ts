import { Observable, of } from "rxjs";
import {
    checkFileAddedToLocal,
    ChangeType,
    Change,
    checkFileModifedLocally,
    checkFileDeletedFromLocal } from "./conflict-check";
import { flatMap } from "rxjs/operators";

const scanLocal: () => Observable<Change> = () => undefined;
const updateRemoteFile: (localChange: Change) => Observable<void> = localChange => undefined;

export const updateRemoteRepository: () => Observable<void>
= () => scanLocal()
    .pipe(
        flatMap(localFileChange => {
            switch (localFileChange.type) {
                case ChangeType.Added:
                    return checkFileAddedToLocal(localFileChange.file)
                    .pipe(
                        flatMap(remoteChangeType => remoteChangeType
                            ? updateRemoteFile(localFileChange)
                            : of(null))
                    );
                case ChangeType.Modified:
                    return checkFileModifedLocally(localFileChange.file)
                    .pipe(
                        flatMap(remoteChangeType => remoteChangeType
                            ? updateRemoteFile(localFileChange)
                            : of(null))
                    );
                case ChangeType.Deleted:
                    return checkFileDeletedFromLocal(localFileChange.file)
                    .pipe(
                        flatMap(remoteChangeType => {
                            switch (remoteChangeType) {
                                case null:
                                case ChangeType.Deleted:
                                    return of(null);
                                default:
                                    updateRemoteFile(localFileChange);
                            }
                        })
                    );
            }
        })
    );
