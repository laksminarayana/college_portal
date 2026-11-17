const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
    const token = req.cookies && req.cookies.student_portal_session;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Authentication required"
        });
    }

    try {
        req.auth = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ["HS256"]
        });
        return next();
    } catch (error) {
        res.clearCookie("student_portal_session", cookieOptions());
        return res.status(401).json({
            success: false,
            message: "Session expired. Please sign in again."
        });
    }
}

function authorize(...roles) {
    return (req, res, next) => {
        if (!req.auth || !roles.includes(req.auth.role)) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to perform this action"
            });
        }

        return next();
    };
}

function cookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/"
    };
}

module.exports = { authenticate, authorize, cookieOptions };
