require("dotenv").config();

const bcrypt = require("bcryptjs");
const { getPool, sql } = require("../database");

async function createFirstAdmin() {
    const name = process.env.ADMIN_NAME && process.env.ADMIN_NAME.trim();
    const email = process.env.ADMIN_EMAIL && process.env.ADMIN_EMAIL.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!name || name.length < 2 || name.length > 120 ||
        !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !password || password.length < 12 || password.length > 128) {
        throw new Error("Set ADMIN_NAME, ADMIN_EMAIL, and an ADMIN_PASSWORD of at least 12 characters.");
    }

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;
    try {
        await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        transactionStarted = true;
        const existing = await new sql.Request(transaction).query(`
            SELECT COUNT(*) AS admin_count
            FROM Users WITH (UPDLOCK, HOLDLOCK)
            WHERE role = 'admin'
        `);
        if (existing.recordset[0].admin_count > 0) {
            throw new Error("An administrator already exists; this command only creates the first account.");
        }

        const passwordHash = await bcrypt.hash(password, 12);
        await new sql.Request(transaction)
            .input("full_name", sql.NVarChar(120), name)
            .input("email", sql.VarChar(254), email)
            .input("password_hash", sql.VarChar(100), passwordHash)
            .query(`
                INSERT INTO Users (full_name, email, password_hash, role)
                VALUES (@full_name, @email, @password_hash, 'admin')
            `);
        await transaction.commit();
        transactionStarted = false;
        console.log("Initial administrator account created.");
    } catch (error) {
        if (transactionStarted) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error("Administrator setup rollback error:", rollbackError.message);
            }
        }
        throw error;
    }
}

createFirstAdmin()
    .catch((error) => {
        console.error("Administrator setup failed:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            const pool = await getPool();
            await pool.close();
        } catch {
            // A failed initial connection has no pool to close.
        }
    });
