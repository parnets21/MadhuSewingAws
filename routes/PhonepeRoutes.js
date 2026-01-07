const express = require('express');
const transactionController = require("../controllers/PhonepeController");
const router = express.Router();

// Test route
router.get("/test", (req, res) => {
  res.json({ message: "PhonePe routes are working!", timestamp: new Date().toISOString() });
});

// Main payment route for mobile app checkout
router.post("/addpayment", transactionController.addPaymentMobile);

// Mobile app redirect after payment (handles deep link redirect)
router.get("/mobile-redirect", transactionController.mobileRedirect);

// Web payment routes
router.post("/addpaymentphonepay", transactionController.addPaymentPhone);
router.post("/makepayment", transactionController.makepayment);

// Payment status routes
router.put("/updateStatuspayment/:id", transactionController.updateStatuspayment);
router.get("/checkPayment/:id/:userId", transactionController.checkPayment);
router.post("/payment-callback", transactionController.paymentcallback);

// Get all payments
router.get("/getallpayment", transactionController.getallpayment);

module.exports = router;
