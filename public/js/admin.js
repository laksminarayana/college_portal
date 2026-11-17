function appendCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value === null || value === undefined ? "" : String(value);
    row.appendChild(cell);
    return cell;
}

async function setTeacherStatus(teacherId, status) {
    const response = await fetch(`/api/admin/teachers/${teacherId}/approval`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Unable to update registration.");
    await loadPendingTeachers();
}

async function loadPendingTeachers() {
    const response = await fetch("/api/admin/teachers/pending");
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Unable to load registrations.");

    const table = document.getElementById("pendingTeachers");
    table.replaceChildren();
    data.teachers.forEach((teacher) => {
        const row = document.createElement("tr");
        appendCell(row, teacher.name);
        appendCell(row, teacher.email);
        appendCell(row, teacher.employee_code);
        appendCell(row, teacher.department);
        const actions = document.createElement("td");
        ["approved", "rejected"].forEach((status) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "table-action";
            button.textContent = status === "approved" ? "Approve" : "Reject";
            button.addEventListener("click", async () => {
                try {
                    await setTeacherStatus(teacher.teacher_id, status);
                    document.getElementById("adminMessage").textContent =
                        `Registration ${status}.`;
                } catch (error) {
                    document.getElementById("adminMessage").textContent = error.message;
                }
            });
            actions.appendChild(button);
        });
        row.appendChild(actions);
        table.appendChild(row);
    });
    if (data.teachers.length === 0) {
        const row = document.createElement("tr");
        const cell = appendCell(row, "There are no pending registrations.");
        cell.colSpan = 5;
        table.appendChild(row);
    }
}

async function loadAcademicOptions() {
    const [departmentResponse, teacherResponse, subjectResponse] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/admin/teachers"),
        fetch("/api/subjects")
    ]);
    const [departmentData, teacherData, subjectData] = await Promise.all([
        departmentResponse.json(),
        teacherResponse.json(),
        subjectResponse.json()
    ]);
    if (!departmentResponse.ok || !teacherResponse.ok || !subjectResponse.ok) {
        throw new Error("Unable to load academic setup options.");
    }

    const departmentSelect = document.getElementById("subjectDepartment");
    departmentSelect.replaceChildren(new Option("Select department", ""));
    departmentData.departments.forEach((department) => {
        departmentSelect.add(new Option(department.department_name, department.department_id));
    });

    const teacherSelect = document.getElementById("assignmentTeacher");
    teacherSelect.replaceChildren(new Option("Select teacher", ""));
    teacherData.teachers.forEach((teacher) => {
        teacherSelect.add(new Option(`${teacher.name} (${teacher.employee_code})`, teacher.teacher_id));
    });

    const subjectSelect = document.getElementById("assignmentSubject");
    subjectSelect.replaceChildren(new Option("Select subject", ""));
    subjectData.forEach((subject) => subjectSelect.add(new Option(subject.subject_name, subject.subject_id)));
}

async function loadAdminPortal() {
    const sessionResponse = await fetch("/api/auth/me");
    if (!sessionResponse.ok) {
        window.location.assign("index.html");
        return;
    }
    const { user, role } = await sessionResponse.json();
    if (role !== "admin") {
        window.location.assign("index.html");
        return;
    }
    document.getElementById("welcomeText").textContent = `Welcome, ${user.name}`;

    const [dashboardResponse] = await Promise.all([
        fetch("/api/dashboard/admin"),
        loadPendingTeachers(),
        loadAcademicOptions()
    ]);
    const data = await dashboardResponse.json();
    if (!dashboardResponse.ok) throw new Error(data.message || "Unable to load dashboard.");

    const dashboard = data.dashboard;
    document.getElementById("totalStudents").textContent = dashboard.total_students;
    document.getElementById("totalTeachers").textContent = dashboard.total_teachers;
    document.getElementById("totalDepartments").textContent = dashboard.total_departments;
    document.getElementById("totalAttendance").textContent = dashboard.total_attendance_records;
}

document.getElementById("departmentForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.getElementById("departmentMessage");
    try {
        const response = await fetch("/api/departments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                department_name: document.getElementById("departmentName").value.trim()
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        document.getElementById("departmentForm").reset();
        message.textContent = "Department added.";
        await loadAcademicOptions();
    } catch (error) {
        message.textContent = error.message;
    }
});

document.getElementById("subjectForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.getElementById("subjectMessage");
    try {
        const response = await fetch("/api/subjects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                subject_name: document.getElementById("subjectName").value.trim(),
                subject_code: document.getElementById("subjectCode").value.trim(),
                department_id: document.getElementById("subjectDepartment").value
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        document.getElementById("subjectForm").reset();
        message.textContent = "Subject added.";
        await loadAcademicOptions();
    } catch (error) {
        message.textContent = error.message;
    }
});

document.getElementById("assignmentForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.getElementById("assignmentMessage");
    try {
        const response = await fetch("/api/admin/teacher-assignments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                teacher_id: document.getElementById("assignmentTeacher").value,
                subject_id: document.getElementById("assignmentSubject").value,
                study_year: document.getElementById("assignmentYear").value,
                section: document.getElementById("assignmentSection").value.trim()
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        document.getElementById("assignmentForm").reset();
        message.textContent = data.message;
    } catch (error) {
        message.textContent = error.message;
    }
});

document.getElementById("logoutButton").addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("index.html");
});

loadAdminPortal().catch((error) => {
    document.getElementById("adminMessage").textContent = error.message;
});
