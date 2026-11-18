/*
    Initial schema for Student Portal.
    Run this script against the Azure SQL database before starting the API.
    It creates schema only; it does not insert sample or production data.
*/

IF OBJECT_ID(N'dbo.Departments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Departments (
        department_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        department_name NVARCHAR(120) NOT NULL UNIQUE,
        is_active BIT NOT NULL CONSTRAINT DF_Departments_IsActive DEFAULT (1),
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_Departments_CreatedAt DEFAULT (SYSUTCDATETIME())
    );
END;

IF OBJECT_ID(N'dbo.Employees', N'U') IS NOT NULL
    AND COL_LENGTH(N'dbo.Employees', N'Department') IS NOT NULL
BEGIN
    INSERT INTO dbo.Departments (department_name)
    SELECT DISTINCT LTRIM(RTRIM(LEFT(CONVERT(NVARCHAR(120), e.Department), 120)))
    FROM dbo.Employees e
    WHERE e.Department IS NOT NULL
        AND LTRIM(RTRIM(CONVERT(NVARCHAR(120), e.Department))) <> N''
        AND NOT EXISTS (
            SELECT 1
            FROM dbo.Departments d
            WHERE d.department_name =
                LTRIM(RTRIM(LEFT(CONVERT(NVARCHAR(120), e.Department), 120)))
        );
END;

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users (
        user_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        full_name NVARCHAR(120) NOT NULL,
        email VARCHAR(254) NOT NULL UNIQUE,
        password_hash VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL,
        phone NVARCHAR(30) NULL,
        is_active BIT NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT (1),
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT (SYSUTCDATETIME()),
        updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_Users_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT CK_Users_Role CHECK (role IN ('student', 'teacher', 'admin'))
    );
END;

IF OBJECT_ID(N'dbo.Students', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Students (
        student_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        student_code NVARCHAR(40) NOT NULL UNIQUE,
        department_id INT NOT NULL,
        study_year TINYINT NOT NULL,
        section NVARCHAR(20) NULL,
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_Students_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT CK_Students_StudyYear CHECK (study_year BETWEEN 1 AND 8),
        CONSTRAINT FK_Students_Users FOREIGN KEY (user_id) REFERENCES dbo.Users(user_id),
        CONSTRAINT FK_Students_Departments FOREIGN KEY (department_id) REFERENCES dbo.Departments(department_id)
    );
END;

IF OBJECT_ID(N'dbo.Teachers', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Teachers (
        teacher_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        employee_code NVARCHAR(40) NOT NULL UNIQUE,
        department_id INT NOT NULL,
        approval_status VARCHAR(20) NOT NULL CONSTRAINT DF_Teachers_Approval DEFAULT ('pending'),
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_Teachers_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT CK_Teachers_Approval CHECK (approval_status IN ('pending', 'approved', 'rejected')),
        CONSTRAINT FK_Teachers_Users FOREIGN KEY (user_id) REFERENCES dbo.Users(user_id),
        CONSTRAINT FK_Teachers_Departments FOREIGN KEY (department_id) REFERENCES dbo.Departments(department_id)
    );
END;

IF OBJECT_ID(N'dbo.Subjects', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Subjects (
        subject_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        subject_name NVARCHAR(120) NOT NULL,
        subject_code NVARCHAR(40) NOT NULL UNIQUE,
        department_id INT NOT NULL,
        is_active BIT NOT NULL CONSTRAINT DF_Subjects_IsActive DEFAULT (1),
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_Subjects_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_Subjects_Departments FOREIGN KEY (department_id) REFERENCES dbo.Departments(department_id)
    );
END;

IF OBJECT_ID(N'dbo.TeacherAssignments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.TeacherAssignments (
        assignment_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        teacher_id INT NOT NULL,
        subject_id INT NOT NULL,
        study_year TINYINT NOT NULL,
        section NVARCHAR(20) NULL,
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_TeacherAssignments_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT CK_TeacherAssignments_StudyYear CHECK (study_year BETWEEN 1 AND 8),
        CONSTRAINT UQ_TeacherAssignments UNIQUE (teacher_id, subject_id, study_year, section),
        CONSTRAINT FK_TeacherAssignments_Teachers FOREIGN KEY (teacher_id) REFERENCES dbo.Teachers(teacher_id),
        CONSTRAINT FK_TeacherAssignments_Subjects FOREIGN KEY (subject_id) REFERENCES dbo.Subjects(subject_id)
    );
END;

IF OBJECT_ID(N'dbo.Attendance', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Attendance (
        attendance_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        student_id INT NOT NULL,
        subject_id INT NOT NULL,
        attendance_date DATE NOT NULL,
        status VARCHAR(10) NOT NULL,
        marked_by INT NOT NULL,
        updated_by INT NOT NULL,
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_Attendance_CreatedAt DEFAULT (SYSUTCDATETIME()),
        updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_Attendance_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT CK_Attendance_Status CHECK (status IN ('present', 'absent', 'late')),
        CONSTRAINT UQ_Attendance_StudentSubjectDate UNIQUE (student_id, subject_id, attendance_date),
        CONSTRAINT FK_Attendance_Students FOREIGN KEY (student_id) REFERENCES dbo.Students(student_id),
        CONSTRAINT FK_Attendance_Subjects FOREIGN KEY (subject_id) REFERENCES dbo.Subjects(subject_id),
        CONSTRAINT FK_Attendance_MarkedBy FOREIGN KEY (marked_by) REFERENCES dbo.Users(user_id),
        CONSTRAINT FK_Attendance_UpdatedBy FOREIGN KEY (updated_by) REFERENCES dbo.Users(user_id)
    );
END;

IF OBJECT_ID(N'dbo.AttendanceAudit', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AttendanceAudit (
        audit_id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        attendance_id INT NOT NULL,
        changed_by INT NOT NULL,
        old_status VARCHAR(10) NULL,
        new_status VARCHAR(10) NOT NULL,
        changed_at DATETIME2(0) NOT NULL CONSTRAINT DF_AttendanceAudit_ChangedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT CK_AttendanceAudit_OldStatus CHECK (old_status IS NULL OR old_status IN ('present', 'absent', 'late')),
        CONSTRAINT CK_AttendanceAudit_NewStatus CHECK (new_status IN ('present', 'absent', 'late')),
        CONSTRAINT FK_AttendanceAudit_Attendance FOREIGN KEY (attendance_id) REFERENCES dbo.Attendance(attendance_id),
        CONSTRAINT FK_AttendanceAudit_Users FOREIGN KEY (changed_by) REFERENCES dbo.Users(user_id)
    );
END;

IF OBJECT_ID(N'dbo.StudentMarks', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.StudentMarks (
        mark_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        student_id INT NOT NULL,
        subject_id INT NOT NULL,
        exam_type NVARCHAR(50) NOT NULL,
        marks TINYINT NOT NULL,
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_StudentMarks_CreatedAt DEFAULT (SYSUTCDATETIME()),
        updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_StudentMarks_UpdatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT CK_StudentMarks_Marks CHECK (marks BETWEEN 0 AND 100),
        CONSTRAINT UQ_StudentMarks_Exam UNIQUE (student_id, subject_id, exam_type),
        CONSTRAINT FK_StudentMarks_Students FOREIGN KEY (student_id) REFERENCES dbo.Students(student_id),
        CONSTRAINT FK_StudentMarks_Subjects FOREIGN KEY (subject_id) REFERENCES dbo.Subjects(subject_id)
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_Attendance_StudentDate' AND object_id = OBJECT_ID(N'dbo.Attendance')
)
    CREATE INDEX IX_Attendance_StudentDate ON dbo.Attendance (student_id, attendance_date);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_Attendance_SubjectDate' AND object_id = OBJECT_ID(N'dbo.Attendance')
)
    CREATE INDEX IX_Attendance_SubjectDate ON dbo.Attendance (subject_id, attendance_date);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_Teachers_ApprovalStatus' AND object_id = OBJECT_ID(N'dbo.Teachers')
)
    CREATE INDEX IX_Teachers_ApprovalStatus ON dbo.Teachers (approval_status);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_Students_ClassRoster' AND object_id = OBJECT_ID(N'dbo.Students')
)
    CREATE INDEX IX_Students_ClassRoster
        ON dbo.Students (department_id, study_year, section)
        INCLUDE (student_id, user_id, student_code);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_TeacherAssignments_TeacherClass' AND object_id = OBJECT_ID(N'dbo.TeacherAssignments')
)
    CREATE INDEX IX_TeacherAssignments_TeacherClass
        ON dbo.TeacherAssignments (teacher_id, study_year, section, subject_id);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_Teachers_ApprovalCreatedAt' AND object_id = OBJECT_ID(N'dbo.Teachers')
)
    CREATE INDEX IX_Teachers_ApprovalCreatedAt
        ON dbo.Teachers (approval_status, created_at)
        INCLUDE (teacher_id, user_id, department_id, employee_code);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_Users_ActiveName' AND object_id = OBJECT_ID(N'dbo.Users')
)
    CREATE INDEX IX_Users_ActiveName
        ON dbo.Users (is_active, full_name)
        INCLUDE (user_id, email, role);