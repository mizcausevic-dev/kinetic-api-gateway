const express = require("express");
const { accounts } = require("../data");

const router = express.Router();

router.get("/", (req, res) => {
  res.json(accounts);
});

module.exports = router;
