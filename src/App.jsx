import React, { lazy, Suspense, useEffect, useState } from "react";
import axios from "axios";

const api = axios.create({ baseURL: "/api", withCredentials: true });
const Dashboard = lazy(() => import("./Dashboard"));

const navigation = {
    student: [
        { id: "overview", label: "Overview", icon: "overview", description: "Your academic snapshot and recent activity." },
        { id: "attendance", label: "Attendance", icon: "attendance", description: "Review attendance by subject." },
        { id: "marks", label: "Results", icon: "results", description: "Keep track of your marks and exams." }
    ],
    teacher: [
        { id: "overview", label: "Overview", icon: "overview", description: "A quick view of your teaching workspace." },
        { id: "attendance", label: "Attendance", icon: "attendance", description: "Record attendance for your assigned students." },
        { id: "marks", label: "Gradebook", icon: "results", description: "Enter and review academic marks." }
    ],
    admin: [
        { id: "overview", label: "Overview", icon: "overview", description: "Monitor activity across your campus." },
        { id: "approvals", label: "Teacher approvals", icon: "approvals", description: "Review teacher account requests." },
        { id: "academic", label: "Academic setup", icon: "academic", description: "Manage departments and subjects." },
        { id: "assignments", label: "Assignments", icon: "assignments", description: "Connect teachers to subjects and classes." }
    ]
};

function getErrorMessage(error) {
    return error.response?.data?.message || error.message || "The request could not be completed.";
}

function Message({ children, error = false }) {
    return children ? <p className={error ? "message error" : "message"} role="status">{children}</p> : null;
}

function PasswordInput({ label, name, autoComplete, minLength, maxLength, required, value, onChange, match }) {
    const [visible, setVisible] = useState(false);

    return (
        <label className="password-field">{label}
            <span className="password-control">
                <input
                    name={name}
                    type={visible ? "text" : "password"}
                    autoComplete={autoComplete}
                    minLength={minLength}
                    maxLength={maxLength}
                    required={required}
                    value={value}
                    onChange={onChange}
                />
                <button
                    className="password-toggle"
                    type="button"
                    aria-label={visible ? "Hide password" : "Show password"}
                    aria-pressed={visible}
                    onClick={() => setVisible(!visible)}
                >
                    <span aria-hidden="true">👁</span>
                </button>
            </span>
            {match && value && (
                <span className={match === "matched" ? "password-match matched" : "password-match mismatch"} aria-live="polite">
                    {match === "matched" ? "✓ Passwords match" : "Passwords do not match"}
                </span>
            )}
        </label>
    );
}

function AuthPanel({ onLogin, initialError }) {
    const [mode, setMode] = useState("login");
    const [departments, setDepartments] = useState([]);
    const [error, setError] = useState(initialError || "");
    const [info, setInfo] = useState("");
    const [busy, setBusy] = useState(false);
    const [registrationRole, setRegistrationRole] = useState("student");
    const [registrationPassword, setRegistrationPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    useEffect(() => {
        if (mode !== "register") return;
        api.get("/departments")
            .then(({ data }) => setDepartments(data.departments))
            .catch((requestError) => setError(getErrorMessage(requestError)));
    }, [mode]);

    async function submitLogin(event) {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
            const { data } = await api.post("/auth/login", {
                email: event.currentTarget.email.value.trim(),
                password: event.currentTarget.password.value,
                role: event.currentTarget.role.value
            });
            onLogin(data.user, data.role);
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        } finally {
            setBusy(false);
        }
    }

    async function submitRegistration(event) {
        event.preventDefault();
        setError("");
        setInfo("");
        const form = event.currentTarget;
        if (registrationPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        setBusy(true);
        const role = form.role.value;
        const payload = {
            role,
            full_name: form.full_name.value.trim(),
            email: form.email.value.trim(),
            password: registrationPassword,
            department_id: form.department_id.value,
            phone: form.phone.value.trim()
        };
        if (role === "student") {
            payload.student_code = form.student_code.value.trim();
            payload.study_year = form.study_year.value;
            payload.section = form.section.value.trim();
        } else {
            payload.employee_code = form.employee_code.value.trim();
        }
        try {
            const { data } = await api.post("/auth/register", payload);
            setInfo(data.message);
            setMode("login");
            setRegistrationPassword("");
            setConfirmPassword("");
            form.reset();
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="auth-page">
            <section className="auth-card">
                <div className="brand-mark" aria-hidden="true">SP</div>
                <p className="eyebrow">CAMPUS MANAGEMENT</p>
                <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
                <p className="muted">
                    {mode === "login"
                        ? "Sign in to continue to your portal."
                        : "Teacher accounts are activated after administrator approval."}
                </p>
                <Message error>{error}</Message>
                <Message>{info}</Message>

                {mode === "login" ? (
                    <form className="form-stack" onSubmit={submitLogin}>
                        <label>Account type
                            <select name="role" required defaultValue="student">
                                <option value="student">Student</option>
                                <option value="teacher">Teacher</option>
                                <option value="admin">Administrator</option>
                            </select>
                        </label>
                        <label>Email
                            <input name="email" type="email" maxLength="254" autoComplete="username" required />
                        </label>
                        <PasswordInput label="Password" name="password" autoComplete="current-password" required />
                        <button className="primary-button" disabled={busy}>
                            {busy ? "Signing in..." : "Sign in"}
                        </button>
                    </form>
                ) : (
                    <form className="form-stack" onSubmit={submitRegistration}>
                        <label>Register as
                            <select name="role" value={registrationRole} onChange={(event) => setRegistrationRole(event.target.value)}>
                                <option value="student">Student</option>
                                <option value="teacher">Teacher</option>
                            </select>
                        </label>
                        <label>Full name
                            <input name="full_name" minLength="2" maxLength="120" autoComplete="name" required />
                        </label>
                        <label>Email
                            <input name="email" type="email" maxLength="254" autoComplete="email" required />
                        </label>
                        {registrationRole === "student" ? (
                            <label>Student ID
                                <input name="student_code" minLength="2" maxLength="40" required />
                            </label>
                        ) : (
                            <label>Employee ID
                                <input name="employee_code" minLength="2" maxLength="40" required />
                            </label>
                        )}
                        <label>Department
                            <select name="department_id" required defaultValue="">
                                <option value="" disabled>Select a department</option>
                                {departments.map((department) => (
                                    <option key={department.department_id} value={department.department_id}>
                                        {department.department_name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {registrationRole === "student" && <div className="form-stack">
                            <label>Year of study
                                <select name="study_year" defaultValue="" required>
                                    <option value="" disabled>Select year</option>
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map((year) => (
                                        <option key={year} value={year}>Year {year}</option>
                                    ))}
                                </select>
                            </label>
                            <label>Section (optional)
                                <input name="section" maxLength="20" />
                            </label>
                        </div>}
                        <label>Phone (optional)
                            <input name="phone" type="tel" maxLength="30" autoComplete="tel" />
                        </label>
                        <PasswordInput
                            label="New password (at least 12 characters)"
                            name="password"
                            minLength="12"
                            maxLength="128"
                            autoComplete="new-password"
                            required
                            value={registrationPassword}
                            onChange={(event) => setRegistrationPassword(event.target.value)}
                        />
                        <PasswordInput
                            label="Confirm password"
                            name="confirm_password"
                            minLength="12"
                            maxLength="128"
                            autoComplete="new-password"
                            required
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            match={confirmPassword ? (registrationPassword === confirmPassword ? "matched" : "mismatch") : ""}
                        />
                        <button className="primary-button" disabled={busy}>
                            {busy ? "Creating account..." : "Create account"}
                        </button>
                    </form>
                )}
                <button className="text-button" type="button" onClick={() => {
                    setError("");
                    setInfo("");
                    setRegistrationPassword("");
                    setConfirmPassword("");
                    setMode(mode === "login" ? "register" : "login");
                }}>
                    {mode === "login" ? "New here? Create an account" : "Already registered? Sign in"}
                </button>
                <aside className="setup-note">
                    <strong>Administrator account</strong>
                    <p>Admin access is not available through public sign-up. From the project folder, run <code>npm run create-admin</code> to securely create the first administrator. See the README for the required environment variables.</p>
                </aside>
            </section>
        </main>
    );
}

function Icon({ name }) {
    const shared = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
    const icons = {
        overview: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
        attendance: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 15l2 2 5-5" /></>,
        results: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 6-7" /></>,
        approvals: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="m16 11 2 2 4-4" /></>,
        academic: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /><path d="M8 7h8M8 11h6" /></>,
        assignments: <><rect x="4" y="4" width="16" height="17" rx="2" /><path d="M9 4.5h6M8 10h8M8 14h8M8 18h5" /><path d="M9 2h6v4H9z" /></>,
        logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" /></>,
        menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>
    };

    return <svg aria-hidden="true" viewBox="0 0 24 24" {...shared}>{icons[name] || icons.overview}</svg>;
}

function Shell({ user, onLogout, children, items, activeView, onNavigate, dark, onToggleTheme }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const activeItem = items.find((item) => item.id === activeView) || items[0];
    const firstName = user.name.split(" ")[0];
    const today = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(new Date());

    return (
        <div className="app-shell">
            {menuOpen && <button className="sidebar-backdrop" type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
            <aside className={`sidebar${menuOpen ? " sidebar-open" : ""}`}>
                <div className="sidebar-brand"><span className="brand-mark small">SP</span><span>Student Portal</span></div>
                <p className="sidebar-caption">MENU</p>
                <div className="sidebar-user">
                    <span className="user-avatar">{firstName.charAt(0).toUpperCase()}</span>
                    <span className="sidebar-user-copy"><strong>{user.name}</strong><span>{user.role} account</span></span>
                </div>
                <nav className="sidebar-nav" aria-label="Main navigation">
                    {items.map((item) => (
                        <button
                            className={`sidebar-link${activeView === item.id ? " active" : ""}`}
                            type="button"
                            key={item.id}
                            aria-current={activeView === item.id ? "page" : undefined}
                            onClick={() => {
                                onNavigate(item.id);
                                setMenuOpen(false);
                            }}
                        >
                            <Icon name={item.icon} />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>
                <div className="sidebar-footer">
                    <button className="sidebar-logout" type="button" onClick={onLogout}><Icon name="logout" /><span>Sign out</span></button>
                    <span className="sidebar-version">STUDENT PORTAL</span>
                </div>
            </aside>
            <main className="main-panel">
                <header className="topbar">
                    <button className="menu-toggle" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Icon name="menu" /></button>
                    <div className="page-context">
                        <p className="eyebrow">{user.role} workspace</p>
                        <h1>{activeItem.label === "Overview" ? `Welcome back, ${firstName}` : activeItem.label}</h1>
                        <p className="muted">{activeItem.description}</p>
                    </div>
                    <div className="topbar-profile">
                        <button className="theme-toggle" type="button" onClick={onToggleTheme} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
                            {dark ? "Light appearance" : "Dark appearance"}
                        </button>
                        <time>{today}</time>
                        <span className="topbar-avatar">{firstName.charAt(0).toUpperCase()}</span>
                        <span className="topbar-user"><strong>{user.name}</strong><small>{user.role}</small></span>
                    </div>
                </header>
                <div className="page-content">{children}</div>
            </main>
        </div>
    );
}

export default function App() {
    const [session, setSession] = useState(null);
    const [checking, setChecking] = useState(true);
    const [dark, setDark] = useState(false);
    const [activeView, setActiveView] = useState("overview");
    const [sessionError, setSessionError] = useState("");

    useEffect(() => {
        api.get("/auth/me")
            .then(({ data }) => setSession({ user: data.user, role: data.role }))
            .catch((requestError) => {
                if (requestError.response?.status !== 401) {
                    setSessionError(getErrorMessage(requestError));
                }
                setSession(null);
            })
            .finally(() => setChecking(false));
    }, []);

    async function logout() {
        try {
            await api.post("/auth/logout");
            setSessionError("");
            setSession(null);
            setActiveView("overview");
        } catch (requestError) {
            setSessionError(getErrorMessage(requestError));
        }
    }

    if (checking) return <div className="loading-screen">Loading Student Portal...</div>;
    if (!session) return <AuthPanel initialError={sessionError} onLogin={(user, role) => {
        setSessionError("");
        setSession({ user, role });
    }} />;

    const items = navigation[session.role] || navigation.student;
    const dashboardUser = { ...session.user, role: session.role };
    const navigate = (view) => setActiveView(view);

    return (
        <div className={dark ? "theme-dark" : ""}>
            <Shell user={dashboardUser} items={items} activeView={activeView} onNavigate={navigate} onLogout={logout} dark={dark} onToggleTheme={() => setDark(!dark)}>
                <Message error>{sessionError}</Message>
                <Suspense fallback={<div className="loading-screen">Loading your workspace...</div>}>
                    <Dashboard user={session.user} role={session.role} view={activeView} onNavigate={navigate} />
                </Suspense>
            </Shell>
        </div>
    );
}
