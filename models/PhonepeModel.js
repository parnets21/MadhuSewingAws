const mongoose = require("mongoose");

const phonepaytransaction = new mongoose.Schema(
    {
       userId: {
        type: String,
       },      
       email:{ 
         type: String,
       },
       username:{
           type:String
       },
       Mobile: {
        type: Number,
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
      phonepeOrderId: {
        type: String,  // PhonePe's order ID (e.g., OMO2601061309256346640202W)
      },
      paymentFlow: {
        type: String,
        enum: ['WEB', 'MOBILE'],
      },
      checkoutUrl: {
        type: String,
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
      error: {
        type: String,
      },
      status: {type: String, 
        default: "InProgress", 
      }, 
    },
    { timestamps: true }
);

const otpModel = mongoose.model("teachertransaction", phonepaytransaction);
module.exports = otpModel;