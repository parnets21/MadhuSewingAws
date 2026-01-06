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
      status: {type: String, 
        default: "InProgress", 
      }, 
    },
    { timestamps: true }
);

const otpModel = mongoose.model("teachertransaction", phonepaytransaction);
module.exports = otpModel;