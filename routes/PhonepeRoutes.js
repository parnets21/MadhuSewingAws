const transactionController=require("../controllers/PhonepeController");
const express=require('express');
const router=express.Router();

// Web-based payment flow endpoints
router.post("/initiate", (req, res) => transactionController.initiate(req, res));
router.get("/verify", (req, res) => transactionController.verify(req, res));

// Legacy SDK endpoints for native mobile app integration
router.post("/initiate-sdk", (req, res) => transactionController.initiateSDK(req, res));

module.exports=router; 