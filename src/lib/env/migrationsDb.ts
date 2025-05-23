import AWS from 'aws-sdk';
import { Key } from 'aws-sdk/clients/dynamodb';
import * as config from './config';

export async function getDdb(profile = 'default') {
    await loadAwsConfig(profile);
    return new AWS.DynamoDB({ apiVersion: '2012-08-10' });
}

export async function configureMigrationsLogDbSchema(ddb: AWS.DynamoDB, env = 'default') {
    const tableName = `MIGRATIONS_LOG_DB_${env.toUpperCase()}`;
    const params = {
        AttributeDefinitions: [
            {
                AttributeName: 'FILE_NAME',
                AttributeType: 'S',
            },
            {
                AttributeName: 'APPLIED_AT',
                AttributeType: 'S',
            },
        ],
        KeySchema: [
            {
                AttributeName: 'FILE_NAME',
                KeyType: 'HASH',
            },
            {
                AttributeName: 'APPLIED_AT',
                KeyType: 'RANGE',
            },
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5,
        },
        TableName: tableName,
        StreamSpecification: {
            StreamEnabled: false,
        },
    };
    ddb.createTable(params, function callback(err) {
        if (err) {
            throw err;
        }
    });

    const migrationParam = {
        TableName: tableName,
    };
    return new Promise((resolve, reject) => {
        ddb.waitFor('tableExists', migrationParam, async function callback(err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

export async function addMigrationToMigrationsLogDb(item: { fileName: string; appliedAt: string }, ddb: AWS.DynamoDB, env = 'default') {
    const tableName = `MIGRATIONS_LOG_DB_${env.toUpperCase()}`;
    const params = {
        TableName: tableName,
        Item: {
            FILE_NAME: { S: item.fileName },
            APPLIED_AT: { S: item.appliedAt },
        },
    };

    // Call DynamoDB to add the item to the table

    return new Promise((resolve, reject) => {
        ddb.putItem(params, async function callback(err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

export async function deleteMigrationFromMigrationsLogDb(
    item: { fileName: string; appliedAt: string },
    ddb: AWS.DynamoDB,
    env = 'default',
) {
    const tableName = `MIGRATIONS_LOG_DB_${env.toUpperCase()}`;
    const params = {
        TableName: tableName,
        Key: {
            FILE_NAME: { S: item.fileName },
            APPLIED_AT: { S: item.appliedAt },
        },
    };

    return new Promise((resolve, reject) => {
        ddb.deleteItem(params, function callback(err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

export async function doesMigrationsLogDbExists(ddb: AWS.DynamoDB, env = 'default') {
    const tableName = `MIGRATIONS_LOG_DB_${env.toUpperCase()}`;
    const params = {
        TableName: tableName,
    };
    return new Promise((resolve) => {
        ddb.describeTable(params, function callback(err) {
            if (err) {
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}

export async function getAllMigrations(ddb: AWS.DynamoDB, env = 'default') {
    const tableName = `MIGRATIONS_LOG_DB_${env.toUpperCase()}`;
    const migrations: { FILE_NAME?: string; APPLIED_AT?: string }[] = [];
    const recursiveProcess = async (lastEvaluatedKey?: Key) => {
        const params = {
            TableName: tableName,
            ExclusiveStartKey: lastEvaluatedKey,
        };

        const { Items, LastEvaluatedKey } = await ddb.scan(params).promise();
        if (Items)
            migrations.push(
                ...Items.map((item) => {
                    return {
                        FILE_NAME: item.FILE_NAME.S,
                        APPLIED_AT: item.APPLIED_AT.S,
                    };
                }),
            );

        if (LastEvaluatedKey) await recursiveProcess(LastEvaluatedKey);
    };

    await recursiveProcess();
    return migrations;
}

async function loadAwsConfig(inputProfile: string) {
    const configFromFile = await config.loadAWSConfig();

    // Check for data for input profile
    const profileConfig = configFromFile.find(
        (obj: { profile: string; region: string; accessKeyId: string; secretAccessKey: string }) => {
            return obj.profile === inputProfile || (!obj.profile && inputProfile === 'default');
        },
    );

    // Populate  region
    if (profileConfig && profileConfig.region) {
        AWS.config.region = profileConfig.region;
    } else {
        throw new Error(`Please provide region for profile:${inputProfile}`);
    }

    if (profileConfig && profileConfig.accessKeyId && profileConfig.secretAccessKey) {
        AWS.config.update({
            accessKeyId: profileConfig.accessKeyId,
            secretAccessKey: profileConfig.secretAccessKey,
        });
    } else {
        // Load config from shared credentials file if present
        AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: inputProfile });
    }
}
