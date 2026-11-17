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

function appendTableRow(table, values) {
    const row = document.createElement("tr");
    values.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value === null || value === undefined ? "" : String(value);
        row.appendChild(cell);
    });
    table.appendChild(row);
}

async function loadStudentPortal() {
    try {
        const sessionResponse = await fetch("/api/auth/me");
        if (!sessionResponse.ok) {
            window.location.assign("index.html");
            return;
        }
        const { user, role } = await sessionResponse.json();
        if (role !== "student") {
            window.location.assign("index.html");
            return;
        }

        document.getElementById("welcomeText").textContent = `Welcome, ${user.name}`;
        document.getElementById("studentName").textContent = user.name || "";
        document.getElementById("studentEmail").textContent = user.email || "";
        document.getElementById("studentDepartment").textContent = user.department || "";
        document.getElementById("studentYear").textContent = user.year || "";
        document.getElementById("studentSection").textContent = user.section || "";

        const [attendanceResponse, marksResponse] = await Promise.all([
            fetch(`/api/student/${user.student_id}/attendance`),
            fetch(`/api/student/${user.student_id}/marks`)
        ]);
        if (!attendanceResponse.ok || !marksResponse.ok) {
            throw new Error("Unable to load student records.");
        }

        const attendanceData = await attendanceResponse.json();
        const marksData = await marksResponse.json();
        const attendanceTable = document.getElementById("attendanceTable");
        attendanceTable.replaceChildren();
        attendanceData.attendance.forEach((item) => appendTableRow(attendanceTable, [
            item.subject_name,
            item.total_classes,
            item.attended_classes,
            `${item.percentage}%`
        ]));

        const marksTable = document.getElementById("marksTable");
        marksTable.replaceChildren();
        marksData.marks.forEach((item) => appendTableRow(marksTable, [
            item.subject_name,
            item.exam_type,
            item.marks
        ]));
    } catch (error) {
        document.getElementById("welcomeText").textContent = error.message;
    }
}

loadStudentPortal();
