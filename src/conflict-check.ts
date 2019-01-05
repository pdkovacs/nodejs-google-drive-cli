import { Observable, of } from "rxjs";
import { flatMap, mapTo } from "rxjs/operators";

export interface GDFile {
    readonly id: string;
    readonly cksum: string;
    readonly lastModified: Date;
}

export enum ChangeType {
    Added,
    Modified,
    Deleted
}

export interface Change {
    readonly type: ChangeType;
    readonly file: GDFile;
}

export const checkFileAddedToLocal: (locallyAdded: GDFile) => Observable<ChangeType>
= locallyAdded => isFileChangedToRemotely(locallyAdded)
    .pipe(
        flatMap(remoteChange => {
            if (remoteChange) {
                switch (remoteChange.type) {
                    case ChangeType.Added:
                        return addConflict({ type: ChangeType.Added, file: locallyAdded}, remoteChange)
                            .pipe(mapTo(remoteChange.type));
                    default:
                        throw new Error(`Unexpected change type for locally added: ${remoteChange.type}`);
                }
            } else {
                return of(null);
            }
        })
    );

export const checkFileModifedLocally: (locallyModified: GDFile) => Observable<ChangeType>
= locallyModified => isFileChangedToRemotely(locallyModified)
    .pipe(
        flatMap(remoteChange => {
            if (remoteChange) {
                switch (remoteChange.type) {
                    case ChangeType.Modified:
                    case ChangeType.Deleted:
                        return addConflict({ type: ChangeType.Modified, file: locallyModified }, remoteChange)
                            .pipe(mapTo(remoteChange.type));
                    default:
                        throw new Error(`Unexpected change type for locally modified: ${remoteChange.type}`);
                }
            } else {
                return of(null);
            }
        })
    );

export const checkFileDeletedFromLocal: (locallyDeleted: GDFile) => Observable<ChangeType>
= locallyDeleted => isFileChangedToRemotely(locallyDeleted)
    .pipe(
        flatMap(remoteChange => {
            if (remoteChange) {
                switch (remoteChange.type) {
                    case ChangeType.Modified:
                        return addConflict({ type: ChangeType.Deleted, file: locallyDeleted}, remoteChange)
                            .pipe(mapTo(remoteChange.type));
                    case ChangeType.Deleted:
                        return of(null);
                    default:
                        throw new Error(`Unexpected change type for locally deleted: ${remoteChange.type}`);
                }
            } else {
                return of(null);
            }
        })
    );

const isFileChangedToRemotely: (f: GDFile) => Observable<Change> = f => undefined;

const addConflict: (localChange: Change, remoteChange: Change) => Observable<void>
= (localChange, remoteChange) => undefined;
