const { defineConfig } = require("vite");

module.exports = defineConfig(({ command }) => ({
    ...(command === "build" ? {
        define: {
            "process.env.NODE_ENV": JSON.stringify("production")
        }
    } : {}),
    server: {
        host: "127.0.0.1",
        port: 5173,
        strictPort: true,
        proxy: {
            "/api": "http://localhost:5000"
        }
    }
}));
