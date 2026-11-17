const { defineConfig } = require("vite");

module.exports = defineConfig({
    server: {
        host: "127.0.0.1",
        port: 5173,
        strictPort: true,
        proxy: {
            "/api": "http://localhost:5000"
        }
    }
});
