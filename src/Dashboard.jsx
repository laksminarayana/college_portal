import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

const api = axios.create({ baseURL: "/api", withCredentials: true });

function getErrorMessage(error) {
    return error.response?.data?.message || error.message || "The request could not be completed.";
}

function Message({ children, error = false }) {
    return children ? <p className={error ? "message error" : "message"} role="status">{children}</p> : null;
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

function paginationFromResponse(response, fallback = { page: 1, limit: 50 }) {
    const total = Number(response.headers["x-total-count"] || 0);
    const limit = Number(response.headers["x-page-size"] || fallback.limit);
    const page = Number(response.headers["x-page"] || fallback.page);
    return { page, limit, total, totalPages: Number(response.headers["x-total-pages"] || 0) };
}

function PaginationControls({ pagination, onPageChange }) {
    if (pagination.totalPages <= 1) return null;
    const firstItem = (pagination.page - 1) * pagination.limit + 1;
    const lastItem = Math.min(pagination.page * pagination.limit, pagination.total);
    return (
        <div className="pagination-controls">
            <span>{firstItem}–{lastItem} of {pagination.total}</span>
            <div>
                <button type="button" className="small-button" disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}>Previous</button>
                <button type="button" className="small-button" disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)}>Next</button>
            </div>
        </div>
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

const AttendanceStudentRow = React.memo(function AttendanceStudentRow({ student, status, onStatusChange }) {
    return (
        <div className="attendance-student-row">
            <div className="attendance-student">
                <span className="student-initial">{student.name.charAt(0).toUpperCase()}</span>
                <span><strong>{student.name}</strong><small>{student.username}</small></span>
            </div>
            <div className="attendance-choice" role="group" aria-label={`Attendance for ${student.name}`}>
                <button className={`attendance-choice-present${status === "present" ? " selected" : ""}`} type="button" aria-pressed={status === "present"} onClick={() => onStatusChange(student.student_id, "present")}>Present</button>
                <button className={`attendance-choice-absent${status === "absent" ? " selected" : ""}`} type="button" aria-pressed={status === "absent"} onClick={() => onStatusChange(student.student_id, "absent")}>Absent</button>
            </div>
        </div>
    );
});

function TeacherDashboard({ user, view, onNavigate }) {
    const [dashboard, setDashboard] = useState(null);
    const [students, setStudents] = useState([]);
    const [studentsPagination, setStudentsPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
    const [subjects, setSubjects] = useState([]);
    const [attendanceClasses, setAttendanceClasses] = useState([]);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
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
        let current = true;
        api.get("/dashboard/teacher")
            .then(({ data }) => {
                if (current) setDashboard(data.dashboard);
            })
            .catch((requestError) => {
                if (current) setError(getErrorMessage(requestError));
            });
        return () => { current = false; };
    }, []);

    useEffect(() => {
        if (view !== "attendance") return undefined;
        let current = true;
        setAttendanceLoading(true);
        api.get("/teacher/attendance-classes")
            .then(({ data }) => {
                if (current) setAttendanceClasses(data);
            })
            .catch((requestError) => {
                if (current) setError(getErrorMessage(requestError));
            })
            .finally(() => {
                if (current) setAttendanceLoading(false);
            });
        return () => { current = false; };
    }, [view]);

    useEffect(() => {
        if (view !== "marks") return undefined;
        let current = true;
        api.get("/subjects")
            .then(({ data }) => {
                if (current) setSubjects(data);
            })
            .catch((requestError) => {
                if (current) setError(getErrorMessage(requestError));
            });
        return () => { current = false; };
    }, [view]);

    useEffect(() => {
        if (view !== "marks") return undefined;
        let current = true;
        api.get("/teacher/students", { params: { page: studentsPagination.page, limit: studentsPagination.limit } })
            .then((response) => {
                if (current) {
                    setStudents(response.data);
                    setStudentsPagination(paginationFromResponse(response, studentsPagination));
                }
            })
            .catch((requestError) => {
                if (current) setError(getErrorMessage(requestError));
            });
        return () => { current = false; };
    }, [view, studentsPagination.page]);

    const updateAttendanceStatus = useCallback((studentId, status) => {
        setAttendanceStatus((current) => ({ ...current, [studentId]: status }));
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

    const studentOptions = useMemo(() => students.map((student) => <option key={student.student_id} value={student.student_id}>{student.name} ({student.username})</option>), [students]);
    const subjectOptions = useMemo(() => subjects.map((subject) => <option key={subject.subject_id} value={subject.subject_id}>{subject.subject_name}</option>), [subjects]);
    const noSectionValue = "__no_section__";
    const sectionValue = (section) => section == null || section === "" ? noSectionValue : String(section);
    const years = useMemo(() => [...new Set(attendanceClasses.map((item) => String(item.study_year)))].sort((a, b) => Number(a) - Number(b)), [attendanceClasses]);
    const sections = useMemo(() => [...new Set(attendanceClasses
        .filter((item) => String(item.study_year) === selectedYear)
        .map((item) => sectionValue(item.section)))].sort((a, b) => a.localeCompare(b)), [attendanceClasses, selectedYear]);
    const classesForSection = useMemo(() => attendanceClasses.filter((item) =>
        String(item.study_year) === selectedYear && sectionValue(item.section) === selectedSection), [attendanceClasses, selectedYear, selectedSection]);
    const attendanceSubjects = useMemo(() => [...new Map(classesForSection.map((item) => [String(item.subject_id), item])).values()], [classesForSection]);
    const attendanceClassesForSelection = useMemo(() => classesForSection.filter((item) => String(item.subject_id) === selectedSubject), [classesForSection, selectedSubject]);
    const attendanceComplete = useMemo(() => attendanceClassesForSelection.length > 0 &&
        attendanceClassesForSelection.every((student) => ["present", "absent"].includes(attendanceStatus[student.student_id])), [attendanceClassesForSelection, attendanceStatus]);

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
                        <select value={selectedYear} required disabled={attendanceLoading || years.length === 0} onChange={(event) => {
                            setSelectedYear(event.target.value);
                            setSelectedSection("");
                            setSelectedSubject("");
                            setAttendanceStatus({});
                            setMessage("");
                            setError("");
                        }}>
                            <option value="" disabled>{attendanceLoading ? "Loading classes..." : "Select year"}</option>
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
                {!attendanceLoading && attendanceClasses.length === 0 && <div className="attendance-empty">No assigned classes with active students are available yet. Contact your administrator if this seems incorrect.</div>}
                {selectedSubject && <div className="attendance-roster">
                    <div className="attendance-roster-heading"><span>Student</span><span>Attendance</span></div>
                    {attendanceClassesForSelection.map((student) => (
                        <AttendanceStudentRow
                            key={student.student_id}
                            student={student}
                            status={attendanceStatus[student.student_id]}
                            onStatusChange={updateAttendanceStatus}
                        />
                    ))}
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
                <PaginationControls pagination={studentsPagination} onPageChange={(page) => setStudentsPagination((current) => ({ ...current, page }))} />
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
    const [pendingPage, setPendingPage] = useState(1);
    const [teacherPage, setTeacherPage] = useState(1);
    const [pendingPagination, setPendingPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
    const [teachersPagination, setTeachersPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
    const [dashboardLoaded, setDashboardLoaded] = useState(false);
    const [pendingLoadedPage, setPendingLoadedPage] = useState(null);
    const [departmentsLoaded, setDepartmentsLoaded] = useState(false);
    const [teachersLoadedPage, setTeachersLoadedPage] = useState(null);
    const [subjectsLoaded, setSubjectsLoaded] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (view !== "overview" || dashboardLoaded) return undefined;
        let current = true;
        api.get("/dashboard/admin")
            .then(({ data }) => {
                if (current) {
                    setDashboard(data.dashboard);
                    setDashboardLoaded(true);
                }
            })
            .catch((requestError) => {
                if (current) setError(getErrorMessage(requestError));
            });
        return () => { current = false; };
    }, [view, dashboardLoaded]);

    useEffect(() => {
        if (!["overview", "approvals"].includes(view) || pendingLoadedPage === pendingPage) return undefined;
        let current = true;
        api.get("/admin/teachers/pending", { params: { page: pendingPage, limit: pendingPagination.limit } })
            .then((response) => {
                if (!current) return;
                setPending(response.data.teachers);
                const nextPagination = paginationFromResponse(response);
                setPendingPagination(nextPagination);
                setPendingLoadedPage(nextPagination.page);
                if (nextPagination.totalPages > 0 && pendingPage > nextPagination.totalPages) {
                    setPendingPage(nextPagination.totalPages);
                }
            })
            .catch((requestError) => {
                if (current) setError(getErrorMessage(requestError));
            });
        return () => { current = false; };
    }, [view, pendingPage, pendingPagination.limit, pendingLoadedPage]);

    useEffect(() => {
        if (view !== "academic" || departmentsLoaded) return undefined;
        let current = true;
        api.get("/departments")
            .then(({ data }) => {
                if (current) {
                    setDepartments(data.departments);
                    setDepartmentsLoaded(true);
                }
            })
            .catch((requestError) => {
                if (current) setError(getErrorMessage(requestError));
            });
        return () => { current = false; };
    }, [view, departmentsLoaded]);

    useEffect(() => {
        if (!["academic", "assignments"].includes(view) || subjectsLoaded) return undefined;
        let current = true;
        api.get("/subjects")
            .then(({ data }) => {
                if (current) {
                    setSubjects(data);
                    setSubjectsLoaded(true);
                }
            })
            .catch((requestError) => {
                if (current) setError(getErrorMessage(requestError));
            });
        return () => { current = false; };
    }, [view, subjectsLoaded]);

    useEffect(() => {
        if (view !== "assignments" || teachersLoadedPage === teacherPage) return undefined;
        let current = true;
        api.get("/admin/teachers", { params: { page: teacherPage, limit: teachersPagination.limit } })
            .then((response) => {
                if (!current) return;
                setTeachers(response.data.teachers);
                const nextPagination = paginationFromResponse(response);
                setTeachersPagination(nextPagination);
                setTeachersLoadedPage(nextPagination.page);
                if (nextPagination.totalPages > 0 && teacherPage > nextPagination.totalPages) {
                    setTeacherPage(nextPagination.totalPages);
                }
            })
            .catch((requestError) => {
                if (current) setError(getErrorMessage(requestError));
            });
        return () => { current = false; };
    }, [view, teacherPage, teachersPagination.limit, teachersLoadedPage]);

    async function approve(teacherId, status) {
        setError("");
        setMessage("");
        try {
            const { data } = await api.put(`/admin/teachers/${teacherId}/approval`, { status });
            setMessage(data.message);
            const [stats, pendingList] = await Promise.all([
                view === "overview" ? api.get("/dashboard/admin") : Promise.resolve(null),
                api.get("/admin/teachers/pending", { params: { page: pendingPage, limit: pendingPagination.limit } })
            ]);
            if (stats) {
                setDashboard(stats.data.dashboard);
                setDashboardLoaded(true);
            } else {
                setDashboardLoaded(false);
            }
            setPending(pendingList.data.teachers);
            const nextPendingPagination = paginationFromResponse(pendingList);
            setPendingPagination(nextPendingPagination);
            setPendingLoadedPage(nextPendingPagination.page);
            if (nextPendingPagination.totalPages > 0 && pendingPage > nextPendingPagination.totalPages) {
                setPendingPage(nextPendingPagination.totalPages);
            }
            setTeachersLoadedPage(null);
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
            if (endpoint === "/departments") {
                const { data: departmentList } = await api.get("/departments");
                setDepartments(departmentList.departments);
                setDepartmentsLoaded(true);
            } else if (endpoint === "/subjects") {
                const { data: subjectList } = await api.get("/subjects");
                setSubjects(subjectList);
                setSubjectsLoaded(true);
            }
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
                        <div className="section-heading"><div><h2>Teacher approvals</h2><p>{pendingPagination.total ? `${pendingPagination.total} request${pendingPagination.total === 1 ? "" : "s"} need your attention.` : "You are all caught up."}</p></div><button className="subtle-button" type="button" onClick={() => onNavigate("approvals")}>View all</button></div>
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
                <div className="section-heading"><div><h2>Teacher registrations</h2><p>Approve or reject new teacher account requests.</p></div><span className="count-badge">{pendingPagination.total} pending</span></div>
                <DataTable headings={["Teacher", "Email", "Employee ID", "Department", "Actions"]} rows={approvalRows} empty="No pending teacher registrations." />
                <PaginationControls pagination={pendingPagination} onPageChange={setPendingPage} />
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
                    <PaginationControls pagination={teachersPagination} onPageChange={setTeacherPage} />
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

export default function Dashboard({ user, role, view, onNavigate }) {
    if (role === "student") return <StudentDashboard user={user} view={view} onNavigate={onNavigate} />;
    if (role === "teacher") return <TeacherDashboard user={user} view={view} onNavigate={onNavigate} />;
    return <AdminDashboard user={user} view={view} onNavigate={onNavigate} />;
}
