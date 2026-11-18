require("dotenv").config();

const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
const path = require("path");
const { getPool, sql } = require("./database");
const { authenticate, authorize, cookieOptions } = require("./middleware/auth");
const { parsePagination, setPaginationHeaders } = require("./pagination");

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const SESSION_DURATION = "8h";
const sessionCookieOptions = {
    ...cookieOptions(),
    maxAge: 8 * 60 * 60 * 1000
};

function isAllowedOrigin(origin, req) {
    let parsedOrigin;
    try {
        parsedOrigin = new URL(origin);
    } catch {
        return false;
    }

    if (parsedOrigin.host === req.get("host")) {
        return true;
    }

    const allowedOrigins = [process.env.FRONTEND_ORIGIN];
    if (process.env.NODE_ENV !== "production") {
        allowedOrigins.push("http://127.0.0.1:5173", "http://localhost:5173");
    }

    return allowedOrigins.some((allowedOrigin) => {
        if (!allowedOrigin) return false;
        try {
            return new URL(allowedOrigin).origin === parsedOrigin.origin;
        } catch {
            return false;
        }
    });
}

app.disable("x-powered-by");
app.use(helmet());
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));
app.use(cookieParser());
app.use("/api", (req, res, next) => {
    const start = process.hrtime.bigint();
    res.setHeader("Cache-Control", "no-store");
    res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        console.log(JSON.stringify({
            type: "api_request",
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration_ms: Number(durationMs.toFixed(2))
        }));
    });
    next();
});
app.use("/api", (req, res, next) => {
    const fetchSite = req.get("sec-fetch-site");
    const origin = req.get("origin");
    let originMismatch = false;
    if (origin) {
        originMismatch = !isAllowedOrigin(origin, req);
    }

    const isWriteRequest = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    const isCrossSite = (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) ||
        originMismatch;
    if (isWriteRequest && isCrossSite) {
        return res.status(403).json({ success: false, message: "Cross-site request rejected" });
    }
    return next();
});
app.use(express.static(path.join(__dirname, "dist"), {
    maxAge: "1y",
    immutable: true,
    setHeaders(res, filePath) {
        if (path.basename(filePath) === "index.html") {
            res.setHeader("Cache-Control", "no-cache");
        }
    }
}));
app.use(express.static(path.join(__dirname, "public")));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many authentication attempts. Try again later."
    }
});

function validEmail(email) {
    return typeof email === "string" &&
        email.length <= 254 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validPassword(password) {
    return typeof password === "string" && password.length >= 12 && password.length <= 128;
}

function positiveInteger(value) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

async function teacherCanManage(userId, studentId, subjectId) {
    const pool = await getPool();
    const result = await pool.request()
        .input("user_id", sql.Int, userId)
        .input("student_id", sql.Int, studentId)
        .input("subject_id", sql.Int, subjectId)
        .query(`
            SELECT 1 AS allowed
            FROM Teachers t
            JOIN TeacherAssignments ta ON ta.teacher_id = t.teacher_id
            JOIN Students s ON s.student_id = @student_id
            JOIN Subjects sub ON sub.subject_id = ta.subject_id
            WHERE t.user_id = @user_id AND t.approval_status = 'approved'
                AND ta.subject_id = @subject_id
                AND sub.department_id = s.department_id
                AND ta.study_year = s.study_year
                AND (ta.section IS NULL OR ta.section = s.section)
        `);
    return result.recordset.length > 0;
}

async function teacherCanManageStudents(userId, studentIds, subjectId) {
    const pool = await getPool();
    const request = pool.request()
        .input("user_id", sql.Int, userId)
        .input("subject_id", sql.Int, subjectId);
    const requestedIds = studentIds.map((studentId, index) => {
        const parameter = `student_id_${index}`;
        request.input(parameter, sql.Int, studentId);
        return `(@${parameter})`;
    });
    const result = await request.query(`
        SELECT COUNT(DISTINCT requested.student_id) AS allowed_count
        FROM (VALUES ${requestedIds.join(",")}) requested(student_id)
        JOIN Teachers t ON t.user_id = @user_id AND t.approval_status = 'approved'
        JOIN TeacherAssignments ta ON ta.teacher_id = t.teacher_id
            AND ta.subject_id = @subject_id
        JOIN Students s ON s.student_id = requested.student_id
            AND s.study_year = ta.study_year
            AND (ta.section IS NULL OR ta.section = s.section)
        JOIN Subjects sub ON sub.subject_id = ta.subject_id
            AND sub.department_id = s.department_id
    `);
    return Number(result.recordset[0].allowed_count) === studentIds.length;
}

function createSessionToken(user) {
    return jwt.sign(
        { user_id: user.user_id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: SESSION_DURATION, algorithm: "HS256" }
    );
}

function isDuplicateKey(error) {
    return error.number === 2601 || error.number === 2627;
}

function logError(context, error) {
    console.error(JSON.stringify({
        type: "api_error",
        context,
        code: error.code || null,
        message: error.message || String(error)
    }));
}

function sendDatabaseError(res, error, context, message) {
    logError(context, error);
    const unavailableCodes = ["ETIMEOUT", "ESOCKET", "ECONNCLOSED", "ENOTOPEN", "ELOGIN"];
    const unavailable = unavailableCodes.includes(error.code) ||
        /failed to connect|connection.*timed out|login failed/i.test(error.message);
    return res.status(unavailable ? 503 : 500).json({
        success: false,
        message: unavailable ? "Azure SQL is unavailable. Check database networking and credentials." : message
    });
}

async function loadUser(userId) {
    const pool = await getPool();
    const result = await pool.request()
        .input("user_id", sql.Int, userId)
        .query(`
            SELECT
                u.user_id,
                u.full_name AS name,
                u.email,
                u.phone,
                u.role,
                d.department_name AS department,
                s.student_id,
                s.student_code AS username,
                s.study_year AS year,
                s.section,
                t.teacher_id,
                t.employee_code,
                t.approval_status
            FROM Users u
            LEFT JOIN Students s ON s.user_id = u.user_id
            LEFT JOIN Teachers t ON t.user_id = u.user_id
            LEFT JOIN Departments d
                ON d.department_id = COALESCE(s.department_id, t.department_id)
            WHERE u.user_id = @user_id AND u.is_active = 1
        `);

    return result.recordset[0] || null;
}

app.get("/api/status", async (req, res) => {
    try {
        const pool = await getPool();
        await pool.request().query("SELECT 1 AS connected");
        res.json({
            success: true,
            message: "Database connected"
        });
    } catch (error) {
        logError("Database status error", error);
        res.status(503).json({
            success: false,
            message: "Database is unavailable"
        });
    }
});

app.get("/api/departments", async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT department_id, department_name
            FROM Departments
            WHERE is_active = 1
            ORDER BY department_name
        `);
        res.json({ success: true, departments: result.recordset });
    } catch (error) {
        return sendDatabaseError(res, error, "Department fetch error", "Unable to fetch departments");
    }
});

app.post("/api/departments", authenticate, authorize("admin"), async (req, res) => {
    const name = typeof req.body.department_name === "string"
        ? req.body.department_name.trim()
        : "";
    if (name.length < 2 || name.length > 120) {
        return res.status(400).json({ success: false, message: "Department name is required" });
    }
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("department_name", sql.NVarChar(120), name)
            .query(`
                INSERT INTO Departments (department_name)
                OUTPUT INSERTED.department_id, INSERTED.department_name
                VALUES (@department_name)
            `);
        return res.status(201).json({ success: true, department: result.recordset[0] });
    } catch (error) {
        if (isDuplicateKey(error)) {
            return res.status(409).json({ success: false, message: "Department already exists" });
        }
        logError("Department creation error", error);
        return res.status(500).json({ success: false, message: "Unable to create department" });
    }
});

app.post("/api/subjects", authenticate, authorize("admin"), async (req, res) => {
    const name = typeof req.body.subject_name === "string" ? req.body.subject_name.trim() : "";
    const code = typeof req.body.subject_code === "string" ? req.body.subject_code.trim() : "";
    const departmentId = positiveInteger(req.body.department_id);
    if (name.length < 2 || name.length > 120 || code.length < 2 || code.length > 40 || !departmentId) {
        return res.status(400).json({ success: false, message: "Provide a valid subject name, code, and department" });
    }
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("subject_name", sql.NVarChar(120), name)
            .input("subject_code", sql.NVarChar(40), code)
            .input("department_id", sql.Int, departmentId)
            .query(`
                INSERT INTO Subjects (subject_name, subject_code, department_id)
                OUTPUT INSERTED.subject_id
                VALUES (@subject_name, @subject_code, @department_id)
            `);
        return res.status(201).json({ success: true, subject_id: result.recordset[0].subject_id });
    } catch (error) {
        if (isDuplicateKey(error)) {
            return res.status(409).json({ success: false, message: "Subject code already exists" });
        }
        logError("Subject creation error", error);
        return res.status(500).json({ success: false, message: "Unable to create subject" });
    }
});

app.post("/api/admin/teacher-assignments", authenticate, authorize("admin"), async (req, res) => {
    const teacherId = positiveInteger(req.body.teacher_id);
    const subjectId = positiveInteger(req.body.subject_id);
    const studyYear = Number(req.body.study_year);
    const section = typeof req.body.section === "string" ? req.body.section.trim() : null;
    if (
        !teacherId ||
        !subjectId ||
        !Number.isInteger(studyYear) ||
        studyYear < 1 ||
        studyYear > 8 ||
        (section && section.length > 20)
    ) {
        return res.status(400).json({ success: false, message: "Provide valid assignment details" });
    }
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("teacher_id", sql.Int, teacherId)
            .input("subject_id", sql.Int, subjectId)
            .input("study_year", sql.TinyInt, studyYear)
            .input("section", sql.NVarChar(20), section || null)
            .query(`
                INSERT INTO TeacherAssignments (teacher_id, subject_id, study_year, section)
                SELECT t.teacher_id, sub.subject_id, @study_year, @section
                FROM Teachers t
                JOIN Users u ON u.user_id = t.user_id
                JOIN Subjects sub ON sub.subject_id = @subject_id
                    AND sub.department_id = t.department_id
                WHERE t.teacher_id = @teacher_id AND t.approval_status = 'approved'
                    AND u.is_active = 1
            `);
        if (result.rowsAffected[0] === 0) {
            return res.status(400).json({
                success: false,
                message: "An approved teacher and a subject in the same department are required"
            });
        }
        return res.status(201).json({ success: true, message: "Teacher assignment created" });
    } catch (error) {
        if (isDuplicateKey(error)) {
            return res.status(409).json({ success: false, message: "That assignment already exists" });
        }
        if (error.number === 547) {
            return res.status(400).json({ success: false, message: "Teacher or subject does not exist" });
        }
        logError("Teacher assignment error", error);
        return res.status(500).json({ success: false, message: "Unable to create assignment" });
    }
});

app.post("/api/auth/register", authLimiter, async (req, res) => {
    const {
        full_name,
        email,
        password,
        role,
        student_code,
        employee_code,
        department_id,
        study_year,
        section,
        phone
    } = req.body;

    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedName = typeof full_name === "string" ? full_name.trim() : "";
    const departmentId = positiveInteger(department_id);
    const year = role === "student" ? Number(study_year) : null;
    const code = role === "student" ? student_code : employee_code;

    if (
        normalizedName.length < 2 ||
        normalizedName.length > 120 ||
        !validEmail(normalizedEmail) ||
        !validPassword(password) ||
        !["student", "teacher"].includes(role) ||
        typeof code !== "string" ||
        code.trim().length < 2 ||
        code.trim().length > 40 ||
        !departmentId ||
        (role === "student" && (!Number.isInteger(year) || year < 1 || year > 8)) ||
        (section !== undefined && (typeof section !== "string" || section.trim().length > 20)) ||
        (phone !== undefined && (typeof phone !== "string" || phone.trim().length > 30))
    ) {
        return res.status(400).json({
            success: false,
            message: "Provide valid registration details. Passwords must be at least 12 characters."
        });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const transaction = new sql.Transaction(await getPool());
    let transactionStarted = false;
    try {
        await transaction.begin();
        transactionStarted = true;
        const userResult = await new sql.Request(transaction)
            .input("full_name", sql.NVarChar(120), normalizedName)
            .input("email", sql.VarChar(254), normalizedEmail)
            .input("password_hash", sql.VarChar(100), passwordHash)
            .input("role", sql.VarChar(20), role)
            .input("phone", sql.NVarChar(30), phone ? phone.trim() : null)
            .query(`
                INSERT INTO Users (full_name, email, password_hash, role, phone)
                OUTPUT INSERTED.user_id
                VALUES (@full_name, @email, @password_hash, @role, @phone)
            `);

        const userId = userResult.recordset[0].user_id;
        const profileRequest = new sql.Request(transaction)
            .input("user_id", sql.Int, userId)
            .input("department_id", sql.Int, departmentId)
            .input("code", sql.NVarChar(40), code.trim());

        if (role === "student") {
            await profileRequest
                .input("study_year", sql.TinyInt, year)
                .input("section", sql.NVarChar(20), section ? section.trim() : null)
                .query(`
                    INSERT INTO Students
                        (user_id, student_code, department_id, study_year, section)
                    VALUES
                        (@user_id, @code, @department_id, @study_year, @section)
                `);
        } else {
            await profileRequest.query(`
                INSERT INTO Teachers (user_id, employee_code, department_id)
                VALUES (@user_id, @code, @department_id)
            `);
        }
        await transaction.commit();
        transactionStarted = false;
        return res.status(201).json({
            success: true,
            message: role === "teacher"
                ? "Registration submitted. A school administrator must approve your account."
                : "Registration successful. You can now sign in."
        });
    } catch (error) {
        if (transactionStarted) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                logError("Registration rollback error", rollbackError);
            }
        }
        if (isDuplicateKey(error)) {
            return res.status(409).json({
                success: false,
                message: "That email or ID is already registered."
            });
        }
        return sendDatabaseError(res, error, "Registration error", "Unable to complete registration");
    }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const { password, role } = req.body;

    if (!validEmail(email) || typeof password !== "string" || password.length > 128 ||
        !["student", "teacher", "admin"].includes(role)) {
        return res.status(400).json({ success: false, message: "Email, password, and role are required" });
    }

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("email", sql.VarChar(254), email)
            .input("role", sql.VarChar(20), role)
            .query(`
                SELECT u.user_id, u.full_name, u.email, u.password_hash, u.role,
                    t.approval_status
                FROM Users u
                LEFT JOIN Teachers t ON t.user_id = u.user_id
                WHERE u.email = @email AND u.role = @role AND u.is_active = 1
            `);
        const user = result.recordset[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        if (user.role === "teacher" && user.approval_status !== "approved") {
            return res.status(403).json({
                success: false,
                message: user.approval_status === "rejected"
                    ? "This teacher registration was not approved."
                    : "Your teacher account is awaiting administrator approval."
            });
        }

        const token = createSessionToken(user);
        const profile = await loadUser(user.user_id);
        res.cookie("student_portal_session", token, sessionCookieOptions);
        return res.json({ success: true, role: user.role, user: profile });
    } catch (error) {
        return sendDatabaseError(res, error, "Login error", "Unable to sign in");
    }
});

app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("student_portal_session", cookieOptions());
    res.json({ success: true, message: "Signed out" });
});

app.get("/api/auth/me", authenticate, async (req, res) => {
    try {
        const user = await loadUser(req.auth.user_id);
        if (!user) {
            res.clearCookie("student_portal_session", cookieOptions());
            return res.status(401).json({ success: false, message: "Account is unavailable" });
        }
        return res.json({ success: true, role: user.role, user });
    } catch (error) {
        logError("Session lookup error", error);
        return res.status(500).json({ success: false, message: "Unable to load session" });
    }
});

app.get("/api/teacher/students", authenticate, authorize("teacher", "admin"), async (req, res) => {
    const pagination = parsePagination(req.query);
    if (!pagination) {
        return res.status(400).json({ success: false, message: "Invalid page or page size" });
    }
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("teacher_user_id", sql.Int, req.auth.user_id)
            .input("is_admin", sql.Bit, req.auth.role === "admin")
            .input("offset", sql.Int, pagination.offset)
            .input("page_size", sql.Int, pagination.limit)
            .query(`
            SELECT COUNT_BIG(*) AS total
            FROM Students s
            JOIN Users u ON u.user_id = s.user_id
            WHERE u.is_active = 1 AND (
                @is_admin = 1 OR EXISTS (
                    SELECT 1
                    FROM TeacherAssignments ta
                    JOIN Teachers t ON t.teacher_id = ta.teacher_id
                    JOIN Subjects sub ON sub.subject_id = ta.subject_id
                    WHERE t.user_id = @teacher_user_id
                        AND sub.department_id = s.department_id
                        AND ta.study_year = s.study_year
                        AND (ta.section IS NULL OR ta.section = s.section)
                )
            );

            SELECT s.student_id, s.student_code AS username, u.full_name AS name, u.email,
                d.department_name AS department, s.study_year AS year, s.section
            FROM Students s
            JOIN Users u ON u.user_id = s.user_id
            JOIN Departments d ON d.department_id = s.department_id
            WHERE u.is_active = 1 AND (
                @is_admin = 1 OR EXISTS (
                    SELECT 1
                    FROM TeacherAssignments ta
                    JOIN Teachers t ON t.teacher_id = ta.teacher_id
                    JOIN Subjects sub ON sub.subject_id = ta.subject_id
                    WHERE t.user_id = @teacher_user_id
                        AND sub.department_id = s.department_id
                        AND ta.study_year = s.study_year
                        AND (ta.section IS NULL OR ta.section = s.section)
                )
            )
            ORDER BY u.full_name, s.student_id
            OFFSET @offset ROWS FETCH NEXT @page_size ROWS ONLY
        `);
        const total = Number(result.recordsets[0][0].total);
        setPaginationHeaders(res, pagination, total);
        return res.json(result.recordsets[1]);
    } catch (error) {
        return sendDatabaseError(res, error, "Student fetch error", "Unable to fetch students");
    }
});

app.get("/api/teacher/attendance-classes", authenticate, authorize("teacher"), async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("teacher_user_id", sql.Int, req.auth.user_id)
            .query(`
                SELECT DISTINCT s.student_id, s.student_code AS username, u.full_name AS name,
                    s.study_year, s.section, sub.subject_id, sub.subject_name
                FROM Teachers t
                JOIN TeacherAssignments ta ON ta.teacher_id = t.teacher_id
                JOIN Subjects sub ON sub.subject_id = ta.subject_id AND sub.is_active = 1
                JOIN Students s ON s.department_id = sub.department_id
                    AND s.study_year = ta.study_year
                    AND (ta.section IS NULL OR ta.section = s.section)
                JOIN Users u ON u.user_id = s.user_id AND u.is_active = 1
                WHERE t.user_id = @teacher_user_id AND t.approval_status = 'approved'
                ORDER BY s.study_year, s.section, sub.subject_name, u.full_name
            `);
        res.json(result.recordset);
    } catch (error) {
        logError("Attendance class fetch error", error);
        res.status(500).json({ success: false, message: "Unable to fetch attendance classes" });
    }
});

app.get("/api/subjects", authenticate, async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("teacher_user_id", sql.Int, req.auth.user_id)
            .input("is_teacher", sql.Bit, req.auth.role === "teacher")
            .query(`
            SELECT subject_id, subject_name
            FROM Subjects s
            WHERE s.is_active = 1 AND (
                @is_teacher = 0 OR EXISTS (
                    SELECT 1
                    FROM TeacherAssignments ta
                    JOIN Teachers t ON t.teacher_id = ta.teacher_id
                    WHERE t.user_id = @teacher_user_id AND ta.subject_id = s.subject_id
                )
            )
            ORDER BY subject_name
        `);
        res.json(result.recordset);
    } catch (error) {
        logError("Subject fetch error", error);
        res.status(500).json({ success: false, message: "Unable to fetch subjects" });
    }
});

app.get("/api/student/:id", authenticate, async (req, res) => {
    const studentId = positiveInteger(req.params.id);
    if (!studentId) {
        return res.status(400).json({ success: false, message: "Invalid student ID" });
    }
    try {
        if (!(await authorizeStudentRecord(req, res, studentId))) return;
        const pool = await getPool();
        const result = await pool.request()
            .input("student_id", sql.Int, studentId)
            .query(`
                SELECT s.student_id, s.student_code AS username, u.full_name AS name, u.email,
                    d.department_name AS department, s.study_year AS year, s.section
                FROM Students s
                JOIN Users u ON u.user_id = s.user_id
                JOIN Departments d ON d.department_id = s.department_id
                WHERE s.student_id = @student_id AND u.is_active = 1
            `);
        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }
        return res.json({ success: true, student: result.recordset[0] });
    } catch (error) {
        logError("Profile error", error);
        return res.status(500).json({ success: false, message: "Unable to fetch student profile" });
    }
});

async function authorizeStudentRecord(req, res, studentId) {
    if (!studentId) {
        res.status(400).json({ success: false, message: "Invalid student ID" });
        return false;
    }
    if (req.auth.role === "admin") {
        return true;
    }
    const user = await loadUser(req.auth.user_id);
    if (req.auth.role === "student" && user && user.student_id === studentId) {
        return true;
    }
    if (req.auth.role === "teacher") {
        const pool = await getPool();
        const result = await pool.request()
            .input("user_id", sql.Int, req.auth.user_id)
            .input("student_id", sql.Int, studentId)
            .query(`
                SELECT 1 AS allowed
                FROM Teachers t
                JOIN TeacherAssignments ta ON ta.teacher_id = t.teacher_id
                JOIN Students s ON s.student_id = @student_id
                JOIN Subjects sub ON sub.subject_id = ta.subject_id
                WHERE t.user_id = @user_id
                    AND ta.study_year = s.study_year
                    AND sub.department_id = s.department_id
                    AND (ta.section IS NULL OR ta.section = s.section)
            `);
        if (result.recordset.length > 0) {
            return true;
        }
    }
    if (!user || (req.auth.role === "student" && user.student_id !== studentId)) {
        res.status(403).json({ success: false, message: "You can only view your own records" });
        return false;
    }
    res.status(403).json({ success: false, message: "You are not assigned to this student" });
    return false;
}

app.get("/api/student/:id/attendance", authenticate, async (req, res) => {
    const studentId = positiveInteger(req.params.id);
    try {
        if (!(await authorizeStudentRecord(req, res, studentId))) return;
        const pool = await getPool();
        const result = await pool.request()
            .input("student_id", sql.Int, studentId)
            .query(`
                SELECT s.subject_id, s.subject_name,
                    COUNT(a.attendance_id) AS total_classes,
                    SUM(CASE WHEN a.status IN ('present', 'late') THEN 1 ELSE 0 END) AS attended_classes,
                    CAST(CASE WHEN COUNT(a.attendance_id) = 0 THEN 0
                        ELSE SUM(CASE WHEN a.status IN ('present', 'late') THEN 100.0 ELSE 0 END)
                            / COUNT(a.attendance_id) END AS DECIMAL(5,2)) AS percentage
                FROM Subjects s
                JOIN Students st ON st.student_id = @student_id
                    AND st.department_id = s.department_id
                LEFT JOIN Attendance a ON a.subject_id = s.subject_id AND a.student_id = @student_id
                WHERE s.is_active = 1
                GROUP BY s.subject_id, s.subject_name
                ORDER BY s.subject_name
            `);
        res.json({ success: true, attendance: result.recordset });
    } catch (error) {
        logError("Attendance fetch error", error);
        res.status(500).json({ success: false, message: "Unable to fetch attendance" });
    }
});

app.get("/api/student/:id/marks", authenticate, async (req, res) => {
    const studentId = positiveInteger(req.params.id);
    try {
        if (!(await authorizeStudentRecord(req, res, studentId))) return;
        const pool = await getPool();
        const result = await pool.request()
            .input("student_id", sql.Int, studentId)
            .query(`
                SELECT m.mark_id, m.student_id, s.subject_id, s.subject_name,
                    m.exam_type, m.marks
                FROM StudentMarks m
                JOIN Subjects s ON s.subject_id = m.subject_id
                WHERE m.student_id = @student_id
                ORDER BY s.subject_name, m.exam_type
            `);
        res.json({ success: true, marks: result.recordset });
    } catch (error) {
        logError("Marks fetch error", error);
        res.status(500).json({ success: false, message: "Unable to fetch marks" });
    }
});

app.post("/api/attendance/mark", authenticate, authorize("teacher", "admin"), async (req, res) => {
    const { records, subject_id, date } = req.body;
    const subjectId = positiveInteger(subject_id);
    const attendanceDate = validDate(date) ? date : null;

    if (
        !subjectId ||
        !attendanceDate ||
        !Array.isArray(records) ||
        records.length < 1 ||
        records.length > 200 ||
        records.some((item) =>
            !item ||
            typeof item !== "object" ||
            !positiveInteger(item.student_id) ||
            !["present", "absent", "late"].includes(item.status))
    ) {
        return res.status(400).json({
            success: false,
            message: "Provide a valid subject, date, and attendance list"
        });
    }

    const uniqueStudentIds = new Set(records.map((item) => Number(item.student_id)));
    if (uniqueStudentIds.size !== records.length) {
        return res.status(400).json({ success: false, message: "A student can appear only once per submission" });
    }

    if (req.auth.role === "teacher") {
        const studentIds = records.map((record) => Number(record.student_id));
        try {
            if (!(await teacherCanManageStudents(req.auth.user_id, studentIds, subjectId))) {
                return res.status(403).json({
                    success: false,
                    message: "You are not assigned to this subject and class"
                });
            }
        } catch (error) {
            return sendDatabaseError(res, error, "Attendance authorization error", "Unable to verify attendance access");
        }
    }

    const transaction = new sql.Transaction(await getPool());
    let transactionStarted = false;
    try {
        await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        transactionStarted = true;
        for (const record of records) {
            const studentId = Number(record.student_id);
            const existing = await new sql.Request(transaction)
                .input("student_id", sql.Int, studentId)
                .input("subject_id", sql.Int, subjectId)
                .input("attendance_date", sql.Date, attendanceDate)
                .query(`
                    SELECT attendance_id, status FROM Attendance
                    WHERE student_id = @student_id AND subject_id = @subject_id
                        AND attendance_date = @attendance_date
                `);

            if (existing.recordset.length > 0) {
                const prior = existing.recordset[0];
                await new sql.Request(transaction)
                    .input("attendance_id", sql.Int, prior.attendance_id)
                    .input("new_status", sql.VarChar(10), record.status)
                    .input("updated_by", sql.Int, req.auth.user_id)
                    .input("old_status", sql.VarChar(10), prior.status)
                    .query(`
                        UPDATE Attendance SET status = @new_status, updated_by = @updated_by,
                            updated_at = SYSUTCDATETIME()
                        WHERE attendance_id = @attendance_id;
                        INSERT INTO AttendanceAudit
                            (attendance_id, changed_by, old_status, new_status)
                        VALUES
                            (@attendance_id, @updated_by, @old_status, @new_status);
                    `);
            } else {
                const inserted = await new sql.Request(transaction)
                    .input("student_id", sql.Int, studentId)
                    .input("subject_id", sql.Int, subjectId)
                    .input("attendance_date", sql.Date, attendanceDate)
                    .input("status", sql.VarChar(10), record.status)
                    .input("marked_by", sql.Int, req.auth.user_id)
                    .query(`
                        INSERT INTO Attendance
                            (student_id, subject_id, attendance_date, status, marked_by, updated_by)
                        OUTPUT INSERTED.attendance_id
                        VALUES
                            (@student_id, @subject_id, @attendance_date, @status, @marked_by, @marked_by)
                    `);
                await new sql.Request(transaction)
                    .input("attendance_id", sql.Int, inserted.recordset[0].attendance_id)
                    .input("changed_by", sql.Int, req.auth.user_id)
                    .input("new_status", sql.VarChar(10), record.status)
                    .query(`
                        INSERT INTO AttendanceAudit (attendance_id, changed_by, old_status, new_status)
                        VALUES (@attendance_id, @changed_by, NULL, @new_status)
                    `);
            }
        }
        await transaction.commit();
        transactionStarted = false;
        return res.json({ success: true, message: "Attendance saved" });
    } catch (error) {
        if (transactionStarted) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                logError("Attendance rollback error", rollbackError);
            }
        }
        logError("Attendance save error", error);
        return res.status(500).json({ success: false, message: "Unable to save attendance" });
    }
});

app.put("/api/teacher/marks", authenticate, authorize("teacher", "admin"), async (req, res) => {
    const studentId = positiveInteger(req.body.student_id);
    const subjectId = positiveInteger(req.body.subject_id);
    const { exam_type, marks } = req.body;
    const score = Number(marks);
    if (!studentId || !subjectId || typeof exam_type !== "string" ||
        exam_type.trim().length < 1 || exam_type.length > 50 ||
        !Number.isInteger(score) || score < 0 || score > 100) {
        return res.status(400).json({ success: false, message: "Provide valid marks details" });
    }
    let transaction;
    let transactionStarted = false;
    try {
        if (req.auth.role === "teacher" &&
            !(await teacherCanManage(req.auth.user_id, studentId, subjectId))) {
            return res.status(403).json({
                success: false,
                message: "You are not assigned to this subject and class"
            });
        }
        transaction = new sql.Transaction(await getPool());
        await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
        transactionStarted = true;
        const request = () => new sql.Request(transaction)
            .input("student_id", sql.Int, studentId)
            .input("subject_id", sql.Int, subjectId)
            .input("exam_type", sql.NVarChar(50), exam_type.trim())
            .input("marks", sql.TinyInt, score);
        const updated = await request().query(`
            UPDATE StudentMarks WITH (UPDLOCK, SERIALIZABLE)
            SET marks = @marks, updated_at = SYSUTCDATETIME()
            WHERE student_id = @student_id
                AND subject_id = @subject_id
                AND exam_type = @exam_type
        `);
        if (updated.rowsAffected[0] === 0) {
            await request().query(`
                INSERT INTO StudentMarks (student_id, subject_id, exam_type, marks)
                VALUES (@student_id, @subject_id, @exam_type, @marks)
            `);
        }
        await transaction.commit();
        transactionStarted = false;
        return res.json({ success: true, message: "Marks saved successfully" });
    } catch (error) {
        if (transactionStarted) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                logError("Marks rollback error", rollbackError);
            }
        }
        logError("Marks save error", error);
        res.status(500).json({ success: false, message: "Unable to save marks" });
    }
});

app.get("/api/dashboard/admin", authenticate, authorize("admin"), async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT
                (SELECT COUNT(*) FROM Students s JOIN Users u ON u.user_id = s.user_id WHERE u.is_active = 1) AS total_students,
                (SELECT COUNT(*) FROM Teachers t JOIN Users u ON u.user_id = t.user_id WHERE u.is_active = 1 AND t.approval_status = 'approved') AS total_teachers,
                (SELECT COUNT(*) FROM Departments WHERE is_active = 1) AS total_departments,
                (SELECT COUNT(*) FROM Attendance) AS total_attendance_records,
                (SELECT COUNT(*) FROM Teachers WHERE approval_status = 'pending') AS pending_teacher_approvals,
                (SELECT CAST(CASE WHEN COUNT(*) = 0 THEN 0 ELSE
                    SUM(CASE WHEN status IN ('present', 'late') THEN 100.0 ELSE 0 END) / COUNT(*)
                    END AS DECIMAL(5,2))
                 FROM Attendance WHERE attendance_date = CONVERT(date, SYSUTCDATETIME()))
                    AS today_attendance_percentage
        `);
        res.json({ success: true, dashboard: result.recordset[0] });
    } catch (error) {
        logError("Admin dashboard error", error);
        res.status(500).json({ success: false, message: "Unable to load dashboard" });
    }
});

app.get("/api/admin/teachers/pending", authenticate, authorize("admin"), async (req, res) => {
    const pagination = parsePagination(req.query);
    if (!pagination) {
        return res.status(400).json({ success: false, message: "Invalid page or page size" });
    }
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("offset", sql.Int, pagination.offset)
            .input("page_size", sql.Int, pagination.limit)
            .query(`
            SELECT COUNT_BIG(*) AS total
            FROM Teachers t
            WHERE t.approval_status = 'pending';

            SELECT t.teacher_id, t.employee_code, u.full_name AS name, u.email,
                d.department_name AS department, t.created_at
            FROM Teachers t
            JOIN Users u ON u.user_id = t.user_id
            JOIN Departments d ON d.department_id = t.department_id
            WHERE t.approval_status = 'pending'
            ORDER BY t.created_at, t.teacher_id
            OFFSET @offset ROWS FETCH NEXT @page_size ROWS ONLY
        `);
        const total = Number(result.recordsets[0][0].total);
        setPaginationHeaders(res, pagination, total);
        return res.json({ success: true, teachers: result.recordsets[1] });
    } catch (error) {
        return sendDatabaseError(res, error, "Pending teacher fetch error", "Unable to fetch pending teachers");
    }
});

app.get("/api/admin/teachers", authenticate, authorize("admin"), async (req, res) => {
    const pagination = parsePagination(req.query);
    if (!pagination) {
        return res.status(400).json({ success: false, message: "Invalid page or page size" });
    }
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("offset", sql.Int, pagination.offset)
            .input("page_size", sql.Int, pagination.limit)
            .query(`
            SELECT COUNT_BIG(*) AS total
            FROM Teachers t
            JOIN Users u ON u.user_id = t.user_id
            WHERE u.is_active = 1 AND t.approval_status = 'approved';

            SELECT t.teacher_id, t.employee_code, u.full_name AS name, u.email,
                d.department_name AS department, t.approval_status
            FROM Teachers t
            JOIN Users u ON u.user_id = t.user_id
            JOIN Departments d ON d.department_id = t.department_id
            WHERE u.is_active = 1 AND t.approval_status = 'approved'
            ORDER BY u.full_name, t.teacher_id
            OFFSET @offset ROWS FETCH NEXT @page_size ROWS ONLY
        `);
        const total = Number(result.recordsets[0][0].total);
        setPaginationHeaders(res, pagination, total);
        return res.json({ success: true, teachers: result.recordsets[1] });
    } catch (error) {
        return sendDatabaseError(res, error, "Teacher fetch error", "Unable to fetch teachers");
    }
});

app.put("/api/admin/teachers/:id/approval", authenticate, authorize("admin"), async (req, res) => {
    const teacherId = positiveInteger(req.params.id);
    const { status } = req.body;
    if (!teacherId || !["approved", "rejected"].includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid teacher approval request" });
    }
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("teacher_id", sql.Int, teacherId)
            .input("status", sql.VarChar(20), status)
            .query(`
                UPDATE Teachers
                SET approval_status = @status
                WHERE teacher_id = @teacher_id AND approval_status = 'pending'
            `);
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ success: false, message: "Pending teacher registration not found" });
        }
        return res.json({ success: true, message: `Teacher registration ${status}` });
    } catch (error) {
        logError("Teacher approval error", error);
        return res.status(500).json({ success: false, message: "Unable to update teacher approval" });
    }
});

app.get("/api/dashboard/teacher", authenticate, authorize("teacher", "admin"), async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("teacher_user_id", sql.Int, req.auth.user_id)
            .input("is_admin", sql.Bit, req.auth.role === "admin")
            .query(`
            SELECT
                (SELECT COUNT(*) FROM Students s JOIN Users u ON u.user_id = s.user_id
                    WHERE u.is_active = 1 AND (@is_admin = 1 OR EXISTS (
                        SELECT 1 FROM TeacherAssignments ta
                        JOIN Teachers t ON t.teacher_id = ta.teacher_id
                        JOIN Subjects sub ON sub.subject_id = ta.subject_id
                        WHERE t.user_id = @teacher_user_id
                            AND sub.department_id = s.department_id
                            AND ta.study_year = s.study_year
                            AND (ta.section IS NULL OR ta.section = s.section)
                    ))) AS total_students,
                (SELECT COUNT(*) FROM Subjects s WHERE s.is_active = 1 AND
                    (@is_admin = 1 OR EXISTS (
                        SELECT 1 FROM TeacherAssignments ta
                        JOIN Teachers t ON t.teacher_id = ta.teacher_id
                        WHERE t.user_id = @teacher_user_id AND ta.subject_id = s.subject_id
                    ))) AS total_subjects
        `);
        res.json({ success: true, dashboard: result.recordset[0] });
    } catch (error) {
        logError("Teacher dashboard error", error);
        res.status(500).json({ success: false, message: "Unable to load dashboard" });
    }
});

app.get("/api/dashboard/student", authenticate, authorize("student"), async (req, res) => {
    try {
        const user = await loadUser(req.auth.user_id);
        if (!user || !user.student_id) {
            return res.status(404).json({ success: false, message: "Student profile not found" });
        }
        const pool = await getPool();
        const result = await pool.request()
            .input("student_id", sql.Int, user.student_id)
            .query(`
                SELECT
                    COUNT(*) AS total_working_days,
                    SUM(CASE WHEN status IN ('present', 'late') THEN 1 ELSE 0 END) AS days_present,
                    CAST(CASE WHEN COUNT(*) = 0 THEN 0 ELSE
                        SUM(CASE WHEN status IN ('present', 'late') THEN 100.0 ELSE 0 END) /
                        COUNT(*) END AS DECIMAL(5,2)) AS attendance_percentage
                FROM Attendance
                WHERE student_id = @student_id
            `);
        res.json({ success: true, user, dashboard: result.recordset[0] });
    } catch (error) {
        logError("Student dashboard error", error);
        res.status(500).json({ success: false, message: "Unable to load dashboard" });
    }
});

app.use("/api", (req, res) => {
    res.status(404).json({ success: false, message: "API endpoint not found" });
});

app.get(/.*/, (req, res, next) => {
    const reactIndex = path.join(__dirname, "dist", "index.html");
    const legacyIndex = path.join(__dirname, "public", "legacy-login.html");
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(require("fs").existsSync(reactIndex) ? reactIndex : legacyIndex, (error) => {
        if (error) next(error);
    });
});

app.use((error, req, res, next) => {
    logError("Unhandled request error", error);
    if (res.headersSent) {
        return next(error);
    }
    return res.status(500).json({ success: false, message: "Internal server error" });
});

async function start() {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        throw new Error("JWT_SECRET must be set to a random value of at least 32 characters");
    }
    const server = app.listen(PORT, () => {
        console.log(`Student Portal running at http://localhost:${PORT}`);
    });
    getPool().catch((error) => {
        logError("Initial Azure SQL connection failed; the API is still running", error);
    });
    return server;
}

if (require.main === module) {
    start().catch((error) => {
        logError("Server startup failed", error);
        process.exitCode = 1;
    });
}

module.exports = { app, start };
