const express = require("express");
const { leads } = require("../data");
const { getLinkedScore } = require("../utils/linkedScore");

const router = express.Router();

router.get("/", (req, res) => {
  res.json(leads);
});

router.get("/:id/score", (req, res, next) => {
  const linkedScore = getLinkedScore(req.params.id);
  if (linkedScore.error) {
    const error = new Error(linkedScore.error === "lead_not_found"
      ? "Lead was not found."
      : "Linked account was not found.");
    error.statusCode = 404;
    return next(error);
  }

  return res.json(linkedScore);
});

router.get("/:id", (req, res, next) => {
  const lead = leads.find((item) => item.id === req.params.id);

  if (!lead) {
    const error = new Error("Lead was not found.");
    error.statusCode = 404;
    return next(error);
  }

  return res.json(lead);
});

module.exports = router;
