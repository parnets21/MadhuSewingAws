const mongoose = require("mongoose");

const phonepaytransaction = new mongoose.Schema(
    {
       userId: {
        type: String,
       }, 
       username:{
           type:String
       },
       Mobile: {
        type: String,
      },
      orderId:{
          type:String
      },
      amount:{
          type:Number,
          default:0
      },
      transactionid: {
        type: String,
      },
      // PhonePe specific fields
      merchantTransactionId: {
        type: String,
      },
      phonepeTransactionId: {
        type: String,
      },
      phonepeResponse: {
        type: mongoose.Schema.Types.Mixed,
      },
      transactionStatus:{
        type:String,
        default:"CR"
      },
      successUrl:{
        type:String
      },
      failedUrl:{
        type:String
      },
      config:{
        type:String  
      },
      status: {
        type: String, 
        default: "INITIATED",
        enum: ['INITIATED', 'PENDING', 'COMPLETED', 'FAILED', 'CANCELLED']
      },
      paymentMethod: {
        type: String,
        default: "WEB"
      },
      error: {
        type: String
      }
    },
    { timestamps: true }
);

const otpModel = mongoose.model("phonepaytransaction", phonepaytransaction);
module.exports = otpModel;