const express = require("express");
const { leads } = require("../data");

const router = express.Router();

router.get("/", (req, res) => {
  res.json(leads);
});

router.get("/:id", (req, res, next) => {
  const lead = leads.find((item) => item.id === req.params.id);

  if (!lead) {
    const error = new Error(`Lead ${req.params.id} was not found.`);
    error.statusCode = 404;
    return next(error);
  }

  return res.json(lead);
});

module.exports = router;
