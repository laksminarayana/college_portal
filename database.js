const sql = require("mssql");

let poolPromise;

function getDatabaseConfig() {
    const required = ["DB_SERVER", "DB_DATABASE", "DB_USER", "DB_PASSWORD"];
    const missing = required.filter((name) => !process.env[name]);

    if (missing.length > 0) {
        throw new Error(`Missing database environment variables: ${missing.join(", ")}`);
    }

    return {
        server: process.env.DB_SERVER,
        database: process.env.DB_DATABASE,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        options: {
            encrypt: process.env.DB_ENCRYPT === "true",
            trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === "true"
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        },
        connectionTimeout: 15000,
        requestTimeout: 15000
    };
}

function getPool() {
    if (!poolPromise) {
        poolPromise = sql.connect(getDatabaseConfig()).catch((error) => {
            poolPromise = undefined;
            throw error;
        });
    }

    return poolPromise;
}

module.exports = { getPool, sql };
