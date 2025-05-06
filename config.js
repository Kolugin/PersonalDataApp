// config.js
require("dotenv").config();

module.exports = {
  SECRET_KEY: process.env.SECRET_KEY,
  DB_FILE: process.env.DB_FILE,
  PORT: process.env.PORT || 3000
};