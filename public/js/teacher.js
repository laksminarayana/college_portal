function showSection(sectionId) {
    document.querySelectorAll(".content-section").forEach((section) => {
        section.classList.toggle("hidden", section.id !== sectionId);
    });
}

document.querySelectorAll("[data-section]").forEach((button) => {
    button.addEventListener("click", () => showSection(button.dataset.section));
});

document.getElementById("logoutButton").addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("index.html");
});

function setMessage(id, text) {
    document.getElementById(id).textContent = text;
}

async function loadOptions(url, selectId, getValue, getLabel) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("Unable to load dashboard options.");
    }
    const items = await response.json();
    const select = document.getElementById(selectId);
    select.replaceChildren();
    items.forEach((item) => select.add(new Option(getLabel(item), getValue(item))));
    return items;
}

async function loadTeacherPortal() {
    const response = await fetch("/api/auth/me");
    if (!response.ok) {
        window.location.assign("index.html");
        return;
    }
    const { user, role } = await response.json();
    if (!["teacher", "admin"].includes(role)) {
        window.location.assign("index.html");
        return;
    }
    document.getElementById("teacherWelcome").textContent = `Welcome, ${user.name}`;

    const dashboardResponse = await fetch("/api/dashboard/teacher");
    if (!dashboardResponse.ok) {
        throw new Error("Unable to load dashboard statistics.");
    }
    const dashboard = (await dashboardResponse.json()).dashboard;
    document.getElementById("totalStudents").textContent = dashboard.total_students;
    document.getElementById("totalSubjects").textContent = dashboard.total_subjects;

    await Promise.all([
        loadOptions("/api/teacher/students", "attendanceStudent",
            (student) => student.student_id,
            (student) => `${student.name} (${student.username})`),
        loadOptions("/api/subjects", "attendanceSubject",
            (subject) => subject.subject_id,
            (subject) => subject.subject_name),
        loadOptions("/api/teacher/students", "marksStudent",
            (student) => student.student_id,
            (student) => `${student.name} (${student.username})`),
        loadOptions("/api/subjects", "marksSubject",
            (subject) => subject.subject_id,
            (subject) => subject.subject_name)
    ]);
}

document.getElementById("attendanceDate").value =
    new Date().toISOString().slice(0, 10);

document.getElementById("saveAttendance").addEventListener("click", async () => {
    const message = document.getElementById("attendanceMessage");
    message.textContent = "Saving...";
    try {
        const response = await fetch("/api/attendance/mark", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                date: document.getElementById("attendanceDate").value,
                subject_id: Number(document.getElementById("attendanceSubject").value),
                records: [{
                    student_id: Number(document.getElementById("attendanceStudent").value),
                    status: document.getElementById("attendanceStatus").value
                }]
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to save attendance.");
        message.textContent = data.message;
    } catch (error) {
        message.textContent = error.message;
    }
});

document.getElementById("saveMarks").addEventListener("click", async () => {
    const message = document.getElementById("marksMessage");
    const marks = Number(document.getElementById("marks").value);
    if (!Number.isInteger(marks) || marks < 0 || marks > 100) {
        message.textContent = "Marks must be a whole number between 0 and 100.";
        return;
    }

    message.textContent = "Saving...";
    try {
        const response = await fetch("/api/teacher/marks", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                student_id: Number(document.getElementById("marksStudent").value),
                subject_id: Number(document.getElementById("marksSubject").value),
                exam_type: document.getElementById("examType").value,
                marks
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to save marks.");
        message.textContent = data.message;
    } catch (error) {
        message.textContent = error.message;
    }
});

loadTeacherPortal().catch((error) => {
    setMessage("teacherWelcome", error.message);
});
