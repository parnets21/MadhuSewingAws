const transactionController = require("../controllers/PhonepeController");
const express = require('express');
const router = express.Router();

// Test route to verify PhonePe routes are working
router.get("/test", (req, res) => {
  res.json({ message: "PhonePe routes are working correctly!", timestamp: new Date().toISOString() });
});

router.post("/addpaymentphonepay", (req, res) => transactionController.addPaymentPhone(req, res));
router.post("/makepayment", (req, res) => transactionController.makepayment(req, res));
router.put("/updateStatuspayment/:id", (req, res) => transactionController.updateStatuspayment(req, res));
router.get("/getallpayment", (req, res) => transactionController.getallpayment(req, res));
router.post("/payment-callback", (req, res) => transactionController.paymentcallback(req, res));
router.get("/checkPayment/:id/:userId", (req, res) => transactionController.checkPayment(req, res));

module.exports = router; 