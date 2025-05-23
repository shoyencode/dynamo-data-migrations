import _ from 'lodash';
import pEachSeries from 'p-each-series';

import * as migrationsDb from '../env/migrationsDb';
import * as migrationsDir from '../env/migrationsDir';
import { status } from './status';

class ERROR extends Error {
    migrated?: string[];
}

export async function up(profile = 'default', env = 'default') {
    const ddb = await migrationsDb.getDdb(profile);
    if (!(await migrationsDb.doesMigrationsLogDbExists(ddb, env))) {
        await migrationsDb.configureMigrationsLogDbSchema(ddb, env);
    }
    const statusItems = await status(profile, env);
    const pendingItems = _.filter(statusItems, { appliedAt: 'PENDING' });
    const migrated: string[] = [];
    const migrateItem = async (item: { fileName: string; appliedAt: string }) => {
        try {
            const migration = await migrationsDir.loadFilesToBeMigrated(item.fileName);
            const migrationUp = migration.up;
            await migrationUp(ddb);
        } catch (error_) {
            const e = error_ as Error;
            const error = new ERROR(`Could not migrate up ${item.fileName}: ${e.message}`);
            error.stack = e.stack;
            error.migrated = migrated;
            throw error;
        }

        const migration = {
            fileName: item.fileName,
            appliedAt: new Date().toJSON(),
        };

        try {
            await migrationsDb.addMigrationToMigrationsLogDb(migration, ddb);
        } catch (error) {
            const e = error as Error;
            throw new Error(`Could not update migrationsLogDb: ${e.message}`);
        }
        migrated.push(item.fileName);
    };

    await pEachSeries(pendingItems, migrateItem);
    return migrated;
}
