const loginForm = document.getElementById("loginForm");
const registrationForm = document.getElementById("registrationForm");
const registrationPanel = document.getElementById("registrationPanel");
const toggleRegistration = document.getElementById("toggleRegistration");
const registerRole = document.getElementById("registerRole");

function setRegistrationRoleFields() {
    const isStudent = registerRole.value === "student";
    document.getElementById("studentCodeField").classList.toggle("hidden", !isStudent);
    document.getElementById("employeeCodeField").classList.toggle("hidden", isStudent);
    document.getElementById("studentAcademicFields").classList.toggle("hidden", !isStudent);
    document.getElementById("studentCode").disabled = !isStudent;
    document.getElementById("studentCode").required = isStudent;
    document.getElementById("employeeCode").disabled = isStudent;
    document.getElementById("employeeCode").required = !isStudent;
    document.getElementById("studyYear").disabled = !isStudent;
    document.getElementById("studyYear").required = isStudent;
}

toggleRegistration.addEventListener("click", () => {
    const showing = registrationPanel.classList.toggle("hidden");
    loginForm.classList.toggle("hidden", !showing);
    toggleRegistration.textContent = showing ? "Back to sign in" : "Create an account";
});

registerRole.addEventListener("change", setRegistrationRoleFields);
setRegistrationRoleFields();

async function loadDepartments() {
    const select = document.getElementById("department");
    try {
        const response = await fetch("/api/departments");
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to load departments");
        }
        select.replaceChildren(new Option("Select department", ""));
        data.departments.forEach((department) => {
            select.add(new Option(department.department_name, department.department_id));
        });
    } catch (error) {
        select.replaceChildren(new Option("Departments unavailable", ""));
        document.getElementById("registrationMessage").textContent = error.message;
    }
}

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.getElementById("loginMessage");
    message.textContent = "Signing in...";

    try {
        const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                role: document.getElementById("loginRole").value,
                email: document.getElementById("loginEmail").value.trim(),
                password: document.getElementById("loginPassword").value
            })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || "Sign in failed");
        }

        const destination = {
            student: "student.html",
            teacher: "teacher.html",
            admin: "admin.html"
        }[data.role];
        window.location.assign(destination);
    } catch (error) {
        message.textContent = error.message || "Unable to connect to the server.";
    }
});

registrationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.getElementById("registrationMessage");
    message.textContent = "Creating account...";
    const role = registerRole.value;
    const payload = {
        role,
        full_name: document.getElementById("fullName").value.trim(),
        email: document.getElementById("registerEmail").value.trim(),
        password: document.getElementById("registerPassword").value,
        department_id: document.getElementById("department").value,
        phone: document.getElementById("phone").value.trim()
    };

    if (role === "student") {
        payload.student_code = document.getElementById("studentCode").value.trim();
        payload.study_year = document.getElementById("studyYear").value;
        payload.section = document.getElementById("section").value.trim();
    } else {
        payload.employee_code = document.getElementById("employeeCode").value.trim();
    }

    try {
        const response = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || "Registration failed");
        }
        message.textContent = data.message;
        registrationForm.reset();
        setRegistrationRoleFields();
        window.setTimeout(() => toggleRegistration.click(), 1200);
    } catch (error) {
        message.textContent = error.message || "Unable to connect to the server.";
    }
});

loadDepartments();
