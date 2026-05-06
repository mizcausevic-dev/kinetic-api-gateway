const express = require("express");
const { campaigns } = require("../data");

const router = express.Router();

router.get("/", (req, res) => {
  res.json(campaigns);
});

module.exports = router;
