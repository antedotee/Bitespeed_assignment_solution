const express = require("express");
const contactRoutes = require("./src/routes/contactRoutes");

const app = express();

app.use(express.json());
app.use("/api/contacts", contactRoutes);

module.exports = app;
