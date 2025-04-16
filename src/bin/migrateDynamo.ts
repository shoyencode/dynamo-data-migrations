#!/usr/bin/env node
import Table from 'cli-table3';
import { Option, program } from 'commander';
import _, { isEmpty } from 'lodash';
import packageJson from '../../package.json';
import { createAction, downAction, initAction, statusAction, upAction } from '../lib/migrateDynamo';

class ERROR extends Error {
    migrated?: string[];
}

function printMigrated(migrated: string[] = [], direction: string) {
    const migratedItemsInfo: string = migrated.map((item) => `${direction}: ${item}`).join('\n');
    console.info(migratedItemsInfo);
}

function printStatusTable(statusItems: { fileName: string; appliedAt: string }[]) {
    const table = new Table({ head: ['Filename', 'Applied At'] });
    table.push(
        ...statusItems.map((item) => {
            return _.values(item);
        }),
    );
    console.info(table.toString());
}
const profileOption = new Option('--profile <string>', 'AWS credentials and configuration to be used')
    .env('AWS_PROFILE')
    .default('default');

const envOption = new Option('--env <string>', 'Environment to be used')
    .env('ENV')
    .default('default');

program
    .command('init')
    .description('initialize a new migration project')
    .action(async () => {
        try {
            await initAction();
            console.info('Initialization successful. Please edit the generated config.json file');
        } catch (error) {
            console.error(error);
        }
    });

program
    .command('create [description]')
    .description('create a new database migration with the provided description')
    .action(async (description) => {
        try {
            const fileName = await createAction(description);
            console.info('Created: migrations/'.concat(fileName));
        } catch (error) {
            console.error(error);
        }
    });

program
    .command('up')
    .addOption(profileOption)
    .addOption(envOption)
    .description('run all pending database migrations against a provided profile.')
    .action(async (option) => {
        try {
            const migrated = await upAction(option.profile, option.env);
            printMigrated(migrated, 'MIGRATED UP');
        } catch (error) {
            console.error(error);
            const e = error as ERROR;
            printMigrated(e.migrated, 'MIGRATED UP');
        }
    });

program
    .command('down')
    .addOption(profileOption)
    .addOption(envOption)
    .option(
        '--shift <n>',
        'Number of down shift to perform. 0 will rollback all changes',
        (value) => Number.parseInt(value, 10),
        1,
    )
    .description('undo the last applied database migration against a provided profile.')
    .action(async (option) => {
        try {
            const migrated = await downAction(option.profile, option.env, option.shift);
            printMigrated(migrated, 'MIGRATED DOWN');
        } catch (error) {
            console.error(error);
        }
    });

program
    .command('status')
    .addOption(profileOption)
    .addOption(envOption)
    .description('print the changelog of the database against a provided profile')
    .action(async (option) => {
        try {
            const statusItems = await statusAction(option.profile, option.env);
            printStatusTable(statusItems);
        } catch (error) {
            console.error(error);
        }
    });

program.version(packageJson.version);

program.parse(process.argv);

if (isEmpty(program.args)) {
    program.outputHelp();
}
