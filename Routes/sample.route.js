const {sayHello, getStarted} = require('../Controllers/sample.controller');

const express = require('express');

const router = express.Router();

router.get("/hello",sayHello);
router.get("/getstart",getStarted);

module.exports = router;
