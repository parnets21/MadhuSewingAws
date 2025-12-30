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
        type: Number,
        // match: /^\+?([0-9]{2})\)?[-. ]?([0-9]{4})[-. ]?([0-9]{4})$/,
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

const otpModel = mongoose.model("phonepaytransaction", phonepaytransaction);
module.exports = otpModel;