import { useEffect, useState } from "react";
import axios from "axios";

const api = axios.create({ baseURL: "/api", withCredentials: true });

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

function AuthPanel({ onLogin }) {
    const [mode, setMode] = useState("login");
    const [departments, setDepartments] = useState([]);
    const [error, setError] = useState("");
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

function Stat({ label, value, detail, tone = "indigo" }) {
    return (
        <article className={`stat-card stat-${tone}`}>
            <div className="stat-top"><span>{label}</span><span className="stat-mark" aria-hidden="true" /></div>
            <strong>{value ?? "—"}</strong>
            {detail && <small>{detail}</small>}
        </article>
    );
}

function QuickLink({ title, description, onClick }) {
    return (
        <button className="quick-link" type="button" onClick={onClick}>
            <span><strong>{title}</strong><small>{description}</small></span>
            <span className="quick-link-arrow" aria-hidden="true">↗</span>
        </button>
    );
}

function DataTable({ headings, rows, empty = "No records to display." }) {
    return (
        <div className="table-scroll">
            <table>
                <thead><tr>{headings.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
                <tbody>
                    {rows.length === 0
                        ? <tr><td className="empty-cell" colSpan={headings.length}>{empty}</td></tr>
                        : rows}
                </tbody>
            </table>
        </div>
    );
}

function StudentDashboard({ user, view, onNavigate }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        Promise.all([
            api.get("/dashboard/student"),
            api.get(`/student/${user.student_id}/attendance`),
            api.get(`/student/${user.student_id}/marks`)
        ]).then(([dashboard, attendance, marks]) => {
            setData({ dashboard: dashboard.data.dashboard, attendance: attendance.data.attendance, marks: marks.data.marks });
        }).catch((requestError) => setError(getErrorMessage(requestError)));
    }, [user.student_id]);

    const attendanceRows = (data?.attendance || []).map((item) => (
        <tr key={item.subject_id}><td>{item.subject_name}</td><td>{item.total_classes}</td><td>{item.attended_classes}</td><td><span className="percentage-pill">{item.percentage}%</span></td></tr>
    ));
    const markRows = (data?.marks || []).map((item) => (
        <tr key={item.mark_id}><td>{item.subject_name}</td><td>{item.exam_type}</td><td><strong>{item.marks}</strong><span className="muted"> / 100</span></td></tr>
    ));
    const markAverage = data?.marks?.length
        ? (data.marks.reduce((total, item) => total + Number(item.marks || 0), 0) / data.marks.length).toFixed(1)
        : "—";
    const initials = user.name
        ? user.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()
        : "S";

    return (
        <>
            <Message error>{error}</Message>
            {view === "overview" && <>
                <section className="student-information-card">
                    <div className="student-information-heading">
                        <span>STUDENT INFORMATION</span>
                        <small>Academic record</small>
                    </div>
                    <div className="student-profile-summary">
                        <div className="student-profile-photo" aria-label={`${user.name} profile`}>{initials}</div>
                        <div className="student-profile-details">
                            <dl>
                                <div><dt>Student name</dt><dd>{user.name}</dd></div>
                                <div><dt>Student ID</dt><dd>{user.username || `S-${user.student_id}`}</dd></div>
                                <div><dt>Department</dt><dd>{user.department || "Not assigned"}</dd></div>
                                <div><dt>Academic year</dt><dd>{user.year ? `Year ${user.year}` : "Not assigned"}</dd></div>
                                <div><dt>Section</dt><dd>{user.section || "Not assigned"}</dd></div>
                                <div><dt>Email</dt><dd>{user.email || "Not available"}</dd></div>
                            </dl>
                        </div>
                    </div>
                </section>
                <div className="stats-grid">
                    <Stat label="Attendance rate" value={data ? `${data.dashboard.attendance_percentage}%` : "—"} detail="Present and late count as attended" tone="indigo" />
                    <Stat label="Days attended" value={data?.dashboard.days_present ?? "—"} detail="Across your recorded classes" tone="teal" />
                    <Stat label="Working days" value={data?.dashboard.total_working_days ?? "—"} detail="Attendance days recorded" tone="amber" />
                    <Stat label="Average marks" value={markAverage === "—" ? "—" : `${markAverage}%`} detail="Across recorded assessments" tone="rose" />
                </div>
                <div className="two-column dashboard-columns">
                    <section className="content-card">
                        <div className="section-heading"><div><h2>Attendance by subject</h2><p>See how you are doing in each class.</p></div><button className="subtle-button" type="button" onClick={() => onNavigate("attendance")}>View all</button></div>
                        <DataTable headings={["Subject", "Attended", "Rate"]} rows={(data?.attendance || []).slice(0, 5).map((item) => (
                            <tr key={item.subject_id}><td>{item.subject_name}</td><td>{item.attended_classes} / {item.total_classes}</td><td><span className="percentage-pill">{item.percentage}%</span></td></tr>
                        ))} />
                    </section>
                    <section className="content-card">
                        <div className="section-heading"><div><h2>Recent results</h2><p>Your latest marks and exam records.</p></div><button className="subtle-button" type="button" onClick={() => onNavigate("marks")}>View all</button></div>
                        <DataTable headings={["Subject", "Exam", "Marks"]} rows={(data?.marks || []).slice(0, 5).map((item) => (
                            <tr key={item.mark_id}><td>{item.subject_name}</td><td>{item.exam_type}</td><td><strong>{item.marks}</strong><span className="muted"> / 100</span></td></tr>
                        ))} />
                    </section>
                </div>
            </>}
            {view === "attendance" && <section className="content-card">
                <div className="section-heading"><div><h2>Subject attendance</h2><p>Present and late count as attended.</p></div></div>
                <DataTable headings={["Subject", "Working days", "Attended", "Attendance rate"]} rows={attendanceRows} />
            </section>}
            {view === "marks" && <section className="content-card">
                <div className="section-heading"><div><h2>Academic results</h2><p>Marks recorded for your subjects.</p></div></div>
                <DataTable headings={["Subject", "Exam", "Marks"]} rows={markRows} />
            </section>}
        </>
    );
}

function TeacherDashboard({ user, view, onNavigate }) {
    const [dashboard, setDashboard] = useState(null);
    const [students, setStudents] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [attendanceClasses, setAttendanceClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [selectedYear, setSelectedYear] = useState("");
    const [selectedSection, setSelectedSection] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("");
    const [attendanceDate, setAttendanceDate] = useState(() => {
        const date = new Date();
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        return date.toISOString().slice(0, 10);
    });
    const [attendanceStatus, setAttendanceStatus] = useState({});
    const [savingAttendance, setSavingAttendance] = useState(false);

    useEffect(() => {
        Promise.all([
            api.get("/dashboard/teacher"),
            api.get("/teacher/students"),
            api.get("/subjects"),
            api.get("/teacher/attendance-classes")
        ]).then(([stats, studentList, subjectList, classList]) => {
            setDashboard(stats.data.dashboard);
            setStudents(studentList.data);
            setSubjects(subjectList.data);
            setAttendanceClasses(classList.data);
        }).catch((requestError) => setError(getErrorMessage(requestError)))
            .finally(() => setLoading(false));
    }, []);

    async function saveAttendance(event) {
        event.preventDefault();
        setError("");
        setMessage("");
        if (!selectedYear || !selectedSection || !selectedSubject || !attendanceDate || !attendanceComplete) {
            setError("Select a year, section, subject, and attendance status for every student.");
            return;
        }
        if (attendanceClassesForSelection.length > 200) {
            setError("This class has more than 200 students. Ask an administrator to split the class before recording attendance.");
            return;
        }
        setSavingAttendance(true);
        try {
            const { data } = await api.post("/attendance/mark", {
                date: attendanceDate,
                subject_id: Number(selectedSubject),
                records: attendanceClassesForSelection.map((student) => ({
                    student_id: student.student_id,
                    status: attendanceStatus[student.student_id]
                }))
            });
            setMessage(data.message);
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        } finally {
            setSavingAttendance(false);
        }
    }

    async function saveMarks(event) {
        event.preventDefault();
        setError("");
        setMessage("");
        const form = event.currentTarget;
        try {
            const { data } = await api.put("/teacher/marks", {
                student_id: form.student_id.value,
                subject_id: form.subject_id.value,
                exam_type: form.exam_type.value,
                marks: Number(form.marks.value)
            });
            setMessage(data.message);
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        }
    }

    const studentOptions = students.map((student) => <option key={student.student_id} value={student.student_id}>{student.name} ({student.username})</option>);
    const subjectOptions = subjects.map((subject) => <option key={subject.subject_id} value={subject.subject_id}>{subject.subject_name}</option>);
    const noSectionValue = "__no_section__";
    const sectionValue = (section) => section == null || section === "" ? noSectionValue : String(section);
    const years = [...new Set(attendanceClasses.map((item) => String(item.study_year)))].sort((a, b) => Number(a) - Number(b));
    const sections = [...new Set(attendanceClasses
        .filter((item) => String(item.study_year) === selectedYear)
        .map((item) => sectionValue(item.section)))].sort((a, b) => a.localeCompare(b));
    const classesForSection = attendanceClasses.filter((item) =>
        String(item.study_year) === selectedYear && sectionValue(item.section) === selectedSection);
    const attendanceSubjects = [...new Map(classesForSection.map((item) => [String(item.subject_id), item])).values()];
    const attendanceClassesForSelection = classesForSection.filter((item) => String(item.subject_id) === selectedSubject);
    const attendanceComplete = attendanceClassesForSelection.length > 0 &&
        attendanceClassesForSelection.every((student) => ["present", "absent"].includes(attendanceStatus[student.student_id]));

    return (
        <>
            <Message error>{error}</Message><Message>{message}</Message>
            {view === "overview" && <>
                <section className="welcome-banner teacher-banner">
                    <div><span className="banner-label">TEACHER SUMMARY</span><h2>Attendance and grade entry</h2><p>Manage your assigned classes and academic records.</p></div>
                </section>
                <div className="stats-grid">
                    <Stat label="Assigned students" value={dashboard?.total_students} detail="Students in your classes" tone="indigo" />
                    <Stat label="Assigned subjects" value={dashboard?.total_subjects} detail="Subjects on your schedule" tone="teal" />
                </div>
                <section className="content-card">
                    <div className="section-heading"><div><h2>Quick actions</h2><p>Pick up where you left off.</p></div></div>
                    <div className="quick-links">
                        <QuickLink title="Take attendance" description="Record today's class attendance." onClick={() => onNavigate("attendance")} />
                        <QuickLink title="Update gradebook" description="Enter a student's exam marks." onClick={() => onNavigate("marks")} />
                    </div>
                </section>
            </>}
            {view === "attendance" && <form className="content-card form-stack attendance-workspace" onSubmit={saveAttendance}>
                <div className="section-heading"><div><h2>Take attendance</h2><p>Select a class to load its student roster, then mark each student present or absent.</p></div></div>
                <div className="attendance-class-fields">
                    <label>Year
                        <select value={selectedYear} required disabled={loading || years.length === 0} onChange={(event) => {
                            setSelectedYear(event.target.value);
                            setSelectedSection("");
                            setSelectedSubject("");
                            setAttendanceStatus({});
                            setMessage("");
                            setError("");
                        }}>
                            <option value="" disabled>{loading ? "Loading classes..." : "Select year"}</option>
                            {years.map((year) => <option key={year} value={year}>Year {year}</option>)}
                        </select>
                    </label>
                    <label>Section
                        <select value={selectedSection} required disabled={!selectedYear} onChange={(event) => {
                            setSelectedSection(event.target.value);
                            setSelectedSubject("");
                            setAttendanceStatus({});
                            setMessage("");
                            setError("");
                        }}>
                            <option value="" disabled>Select section</option>
                            {sections.map((section) => <option key={section} value={section}>{section === noSectionValue ? "No section" : section}</option>)}
                        </select>
                    </label>
                    <label>Subject
                        <select value={selectedSubject} required disabled={!selectedSection} onChange={(event) => {
                            setSelectedSubject(event.target.value);
                            setAttendanceStatus({});
                            setMessage("");
                            setError("");
                        }}>
                            <option value="" disabled>Select subject</option>
                            {attendanceSubjects.map((subject) => <option key={subject.subject_id} value={subject.subject_id}>{subject.subject_name}</option>)}
                        </select>
                    </label>
                </div>
                <div className="attendance-date-row">
                    <label>Date<input type="date" value={attendanceDate} onChange={(event) => setAttendanceDate(event.target.value)} required /></label>
                    {selectedSubject && <span className="attendance-roster-count">{attendanceClassesForSelection.length} {attendanceClassesForSelection.length === 1 ? "student" : "students"}</span>}
                </div>
                {!loading && attendanceClasses.length === 0 && <div className="attendance-empty">No assigned classes with active students are available yet. Contact your administrator if this seems incorrect.</div>}
                {selectedSubject && <div className="attendance-roster">
                    <div className="attendance-roster-heading"><span>Student</span><span>Attendance</span></div>
                    {attendanceClassesForSelection.map((student) => {
                        const status = attendanceStatus[student.student_id];
                        return (
                            <div className="attendance-student-row" key={student.student_id}>
                                <div className="attendance-student">
                                    <span className="student-initial">{student.name.charAt(0).toUpperCase()}</span>
                                    <span><strong>{student.name}</strong><small>{student.username}</small></span>
                                </div>
                                <div className="attendance-choice" role="group" aria-label={`Attendance for ${student.name}`}>
                                    <button className={`attendance-choice-present${status === "present" ? " selected" : ""}`} type="button" aria-pressed={status === "present"} onClick={() => setAttendanceStatus((current) => ({ ...current, [student.student_id]: "present" }))}>Present</button>
                                    <button className={`attendance-choice-absent${status === "absent" ? " selected" : ""}`} type="button" aria-pressed={status === "absent"} onClick={() => setAttendanceStatus((current) => ({ ...current, [student.student_id]: "absent" }))}>Absent</button>
                                </div>
                            </div>
                        );
                    })}
                    {attendanceClassesForSelection.length > 200 && <p className="attendance-limit-message">Attendance can be submitted for up to 200 students at a time.</p>}
                    <div className="attendance-submit-row">
                        <span>{attendanceComplete ? "Every student has a status." : "Choose Present or Absent for each student."}</span>
                        <button className="primary-button" type="submit" disabled={!attendanceComplete || savingAttendance || attendanceClassesForSelection.length > 200}>
                            {savingAttendance ? "Saving attendance..." : "Save attendance"}
                        </button>
                    </div>
                </div>}
            </form>}
            {view === "marks" && <form className="content-card form-stack workspace-form" onSubmit={saveMarks}>
                <div className="section-heading"><div><h2>Enter marks</h2><p>Save a student's result for an exam.</p></div></div>
                <label>Student<select name="student_id" required defaultValue="">{students.length === 0 && <option value="" disabled>No assigned students</option>}{students.length > 0 && <option value="" disabled>Select a student</option>}{studentOptions}</select></label>
                <label>Subject<select name="subject_id" required defaultValue="">{subjects.length === 0 && <option value="" disabled>No assigned subjects</option>}{subjects.length > 0 && <option value="" disabled>Select a subject</option>}{subjectOptions}</select></label>
                <div className="two-column form-row">
                    <label>Exam type<input name="exam_type" maxLength="50" placeholder="e.g. Midterm" required /></label>
                    <label>Marks (0-100)<input name="marks" type="number" min="0" max="100" step="1" placeholder="0 - 100" required /></label>
                </div>
                <button className="primary-button" disabled={!students.length || !subjects.length}>Save marks</button>
            </form>}
        </>
    );
}

function AdminDashboard({ user, view, onNavigate }) {
    const [dashboard, setDashboard] = useState(null);
    const [pending, setPending] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    async function refresh() {
        const [stats, pendingList, departmentsList, teacherList, subjectList] = await Promise.all([
            api.get("/dashboard/admin"),
            api.get("/admin/teachers/pending"),
            api.get("/departments"),
            api.get("/admin/teachers"),
            api.get("/subjects")
        ]);
        setDashboard(stats.data.dashboard);
        setPending(pendingList.data.teachers);
        setDepartments(departmentsList.data.departments);
        setTeachers(teacherList.data.teachers);
        setSubjects(subjectList.data);
    }

    useEffect(() => {
        refresh().catch((requestError) => setError(getErrorMessage(requestError)));
    }, []);

    async function approve(teacherId, status) {
        setError("");
        setMessage("");
        try {
            const { data } = await api.put(`/admin/teachers/${teacherId}/approval`, { status });
            setMessage(data.message);
            await refresh();
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        }
    }

    async function submitForm(event, endpoint, payload, success) {
        event.preventDefault();
        setError("");
        setMessage("");
        const form = event.currentTarget;
        try {
            const { data } = await api.post(endpoint, payload);
            setMessage(data.message || success);
            form.reset();
            await refresh();
        } catch (requestError) {
            setError(getErrorMessage(requestError));
        }
    }

    const approvalRows = pending.map((teacher) => (
        <tr key={teacher.teacher_id}>
            <td><span className="table-person"><span className="table-avatar">{teacher.name.charAt(0).toUpperCase()}</span><strong>{teacher.name}</strong></span></td>
            <td>{teacher.email}</td><td>{teacher.employee_code}</td><td>{teacher.department}</td>
            <td className="actions">
                <button className="small-button" type="button" onClick={() => approve(teacher.teacher_id, "approved")}>Approve</button>
                <button className="small-button danger" type="button" onClick={() => approve(teacher.teacher_id, "rejected")}>Reject</button>
            </td>
        </tr>
    ));

    return (
        <>
            <Message error>{error}</Message><Message>{message}</Message>
            {view === "overview" && <>
                <section className="welcome-banner admin-banner">
                    <div><span className="banner-label">ADMINISTRATION</span><h2>Manage campus accounts and classes</h2><p>Review teacher requests and maintain academic setup.</p></div>
                </section>
                <div className="stats-grid">
                    <Stat label="Students" value={dashboard?.total_students} detail="Registered learners" tone="indigo" />
                    <Stat label="Approved teachers" value={dashboard?.total_teachers} detail="Active teaching accounts" tone="teal" />
                    <Stat label="Departments" value={dashboard?.total_departments} detail="Across your campus" tone="amber" />
                    <Stat label="Pending approvals" value={dashboard?.pending_teacher_approvals} detail="Teacher requests to review" tone="rose" />
                </div>
                <div className="two-column dashboard-columns">
                    <section className="content-card">
                        <div className="section-heading"><div><h2>Teacher approvals</h2><p>{pending.length ? `${pending.length} request${pending.length === 1 ? "" : "s"} need your attention.` : "You are all caught up."}</p></div><button className="subtle-button" type="button" onClick={() => onNavigate("approvals")}>View all</button></div>
                        <DataTable headings={["Teacher", "Department", "Status"]} rows={pending.slice(0, 5).map((teacher) => (
                            <tr key={teacher.teacher_id}><td>{teacher.name}</td><td>{teacher.department}</td><td><span className="status-pill">Pending</span></td></tr>
                        ))} />
                    </section>
                    <section className="content-card admin-activity">
                        <div className="section-heading"><div><h2>Campus activity</h2><p>A snapshot of recorded activity.</p></div></div>
                        <div className="activity-row"><span className="activity-mark indigo-mark">✓</span><span><strong>Attendance records</strong><small>All classes</small></span><b>{dashboard?.total_attendance_records ?? "—"}</b></div>
                        <div className="activity-row"><span className="activity-mark teal-mark">↗</span><span><strong>Today's attendance</strong><small>Attendance rate</small></span><b>{dashboard ? `${dashboard.today_attendance_percentage}%` : "—"}</b></div>
                    </section>
                </div>
            </>}
            {view === "approvals" && <section className="content-card">
                <div className="section-heading"><div><h2>Teacher registrations</h2><p>Approve or reject new teacher account requests.</p></div><span className="count-badge">{pending.length} pending</span></div>
                <DataTable headings={["Teacher", "Email", "Employee ID", "Department", "Actions"]} rows={approvalRows} empty="No pending teacher registrations." />
            </section>}
            {view === "academic" && <div className="two-column dashboard-columns">
                <form className="content-card form-stack" onSubmit={(event) => {
                    const formData = new FormData(event.currentTarget);
                    return submitForm(event, "/departments", { department_name: formData.get("department_name") }, "Department added.");
                }}>
                    <div className="section-heading"><div><h2>Add department</h2><p>Create a department for registration and subject setup.</p></div></div>
                    <label>Department name<input name="department_name" maxLength="120" placeholder="e.g. Computer Science" required /></label>
                    <button className="primary-button">Add department</button>
                </form>
                <form className="content-card form-stack" onSubmit={(event) => {
                    const formData = new FormData(event.currentTarget);
                    return submitForm(event, "/subjects", {
                        subject_name: formData.get("subject_name"),
                        subject_code: formData.get("subject_code"),
                        department_id: formData.get("department_id")
                    }, "Subject added.");
                }}>
                    <div className="section-heading"><div><h2>Add subject</h2><p>Organize course subjects under a department.</p></div></div>
                    <label>Subject name<input name="subject_name" maxLength="120" placeholder="e.g. Data Structures" required /></label>
                    <label>Subject code<input name="subject_code" maxLength="40" placeholder="e.g. CS201" required /></label>
                    <label>Department<select name="department_id" required defaultValue="">{departments.length === 0 && <option value="" disabled>Add a department first</option>}{departments.length > 0 && <option value="" disabled>Select a department</option>}{departments.map((department) => <option key={department.department_id} value={department.department_id}>{department.department_name}</option>)}</select></label>
                    <button className="primary-button" disabled={!departments.length}>Add subject</button>
                </form>
            </div>}
            {view === "assignments" && <div className="dashboard-columns">
                <form className="content-card form-stack" onSubmit={(event) => {
                    const formData = new FormData(event.currentTarget);
                    return submitForm(event, "/admin/teacher-assignments", {
                        teacher_id: formData.get("teacher_id"),
                        subject_id: formData.get("subject_id"),
                        study_year: formData.get("study_year"),
                        section: formData.get("section")
                    }, "Teacher assignment created.");
                }}>
                    <div className="section-heading"><div><h2>Assign a teacher</h2><p>Give an approved teacher access to a subject and class.</p></div></div>
                    <label>Teacher<select name="teacher_id" required defaultValue="">{teachers.length === 0 && <option value="" disabled>No approved teachers available</option>}{teachers.length > 0 && <option value="" disabled>Select a teacher</option>}{teachers.map((teacher) => <option key={teacher.teacher_id} value={teacher.teacher_id}>{teacher.name}</option>)}</select></label>
                    <label>Subject<select name="subject_id" required defaultValue="">{subjects.length === 0 && <option value="" disabled>No subjects available</option>}{subjects.length > 0 && <option value="" disabled>Select a subject</option>}{subjects.map((subject) => <option key={subject.subject_id} value={subject.subject_id}>{subject.subject_name}</option>)}</select></label>
                    <div className="two-column form-row">
                        <label>Year of study<select name="study_year" defaultValue="1">{[1, 2, 3, 4, 5, 6, 7, 8].map((year) => <option key={year} value={year}>Year {year}</option>)}</select></label>
                        <label>Section (optional)<input name="section" maxLength="20" placeholder="e.g. A" /></label>
                    </div>
                    <button className="primary-button" disabled={!teachers.length || !subjects.length}>Create assignment</button>
                </form>
            </div>}
        </>
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
            .catch(() => setSession(null))
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
    if (!session) return <AuthPanel onLogin={(user, role) => setSession({ user, role })} />;

    let dashboard;
    const items = navigation[session.role] || navigation.student;
    const dashboardUser = { ...session.user, role: session.role };
    const navigate = (view) => setActiveView(view);
    if (session.role === "student") dashboard = <StudentDashboard user={session.user} view={activeView} onNavigate={navigate} />;
    else if (session.role === "teacher") dashboard = <TeacherDashboard user={session.user} view={activeView} onNavigate={navigate} />;
    else dashboard = <AdminDashboard user={session.user} view={activeView} onNavigate={navigate} />;

    return (
        <div className={dark ? "theme-dark" : ""}>
            <Shell user={dashboardUser} items={items} activeView={activeView} onNavigate={navigate} onLogout={logout} dark={dark} onToggleTheme={() => setDark(!dark)}>
                <Message error>{sessionError}</Message>
                {dashboard}
            </Shell>
        </div>
    );
}
