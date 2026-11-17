const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret-that-is-at-least-thirty-two-characters";
const { app } = require("../server");

let server;
let baseUrl;

before(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
});

test("protected student APIs reject unauthenticated requests", async () => {
    const response = await fetch(`${baseUrl}/api/student/1/attendance`);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).success, false);
});

test("attendance class rosters are restricted to authenticated teachers", async () => {
    const unauthenticated = await fetch(`${baseUrl}/api/teacher/attendance-classes`);
    assert.equal(unauthenticated.status, 401);

    const token = jwt.sign(
        { user_id: 7, role: "student" },
        process.env.JWT_SECRET,
        { expiresIn: "1m", algorithm: "HS256" }
    );
    const studentResponse = await fetch(`${baseUrl}/api/teacher/attendance-classes`, {
        headers: { Cookie: `student_portal_session=${token}` }
    });
    assert.equal(studentResponse.status, 403);
});

test("admin APIs reject authenticated non-admin users", async () => {
    const token = jwt.sign(
        { user_id: 7, role: "student" },
        process.env.JWT_SECRET,
        { expiresIn: "1m", algorithm: "HS256" }
    );
    const response = await fetch(`${baseUrl}/api/admin/teachers/pending`, {
        headers: { Cookie: `student_portal_session=${token}` }
    });
    assert.equal(response.status, 403);
});

test("public registration cannot create administrator accounts", async () => {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "admin" })
    });
    assert.equal(response.status, 400);
});

test("cross-site state-changing requests are rejected", async () => {
    const response = await fetch(`${baseUrl}/api/auth/logout`, {
        method: "POST",
        headers: {
            Origin: "https://untrusted.example",
            "Sec-Fetch-Site": "cross-site"
        }
    });
    assert.equal(response.status, 403);
});

test("the configured Vite origin can make state-changing API requests", async () => {
    const response = await fetch(`${baseUrl}/api/auth/logout`, {
        method: "POST",
        headers: {
            Origin: process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5173",
            "Sec-Fetch-Site": "same-origin"
        }
    });
    assert.equal(response.status, 200);
});

test("the React app shell is served at the root", async () => {
    const response = await fetch(`${baseUrl}/`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Student Portal/);
});
