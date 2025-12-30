// const transactionModel = require("../../Modal/User/phonepayModel");
const axios = require("axios");
const crypto = require('crypto');

// const MERCHANT_ID = "M22IJ7E10A8LQ";
// const SECRET_KEY = "323bd89f-a6c5-402f-a659-043df2b7b3c9";  
// const PHONEPE_API_URL = "https://api.phonepe.com/apis/hermes/pg/v1/pay"; 
// const CALLBACK_URL = "https://madhusewingmachines.com";  

const transactionModel = require("../models/PhonepeModel");

const {
  StandardCheckoutClient,
  Env,
  StandardCheckoutPayRequest,
  MetaInfo,
  CreateSdkOrderRequest
} = require("pg-sdk-node");

// const clientId = "M22IJ7E10A8LQ";
const clientId = "SU2512301550183276999448";
const clientSecret = "f0c866c6-0264-4729-ba6e-deb661a8ea0b";
const clientVersion = 1;
const env = Env.PRODUCTION;
// const env = Env.SANDBOX;
// const CALLBACK_URL = "https://madhusewingmachines.com/update/paymentstatus/:id";

const client = StandardCheckoutClient.getInstance(
  clientId,
  clientSecret,
  clientVersion,
  env
);

class Transaction {

  async addPaymentPhone(req, res) {

    try {
      const { userId, username, Mobile, orderId, amount, config,successUrl,failedUrl } = req.body;

      // Save transaction details in DB
      const data = await transactionModel.create({
        userId,
        username,
        Mobile,
        orderId,
        amount,
        config,
        successUrl,failedUrl
      });

      if (!data)
        return res.status(400).json({ error: "Something went wrong" });

      const merchantOrderId = data._id.toString(); // Use DB _id as unique order ID

      // Use successUrl from request or default to production URL
      const baseUrl = successUrl ? successUrl.split('/OrderHistory')[0] : 'https://madhusewingmachines.com';
      const redirectUrl = `${baseUrl}/PaymentSuccess?transactionId=${data._id}&userID=${userId}`;

      // Build the payment request
      const paymentRequest = CreateSdkOrderRequest.StandardCheckoutBuilder()
        .merchantOrderId(merchantOrderId)
        .amount(amount * 100) // Convert to paise
        .redirectUrl(redirectUrl)
        .build();

      // Send payment request to PhonePe
      const response = await client.pay(paymentRequest);
      console.log("response", response)
      const checkoutUrl = response.redirectUrl;


      if (!checkoutUrl) {
        console.error("Invalid PhonePe response:", response);
        return res.status(500).json({ error: "PhonePe did not return a URL" });
      }

      return res.status(200).json({
        orderId: response.orderId,
        merchantID: merchantOrderId,
        url: checkoutUrl,
      });
    } catch (error) {
      console.error("Payment Error:", error);
      return res.status(500).json({ error: "Payment processing failed" });
    }
  }

  async addPaymentMobile(req, res) {
    let transaction; // Declare transaction here to fix the ReferenceError

    try {
      // Validate input
      const { userId, username, Mobile, orderId, amount } = req.body;
      if (!userId || !username || !Mobile || !amount) {
        return res.status(400).json({ error: "Missing required fields" });
      }

  
      transaction = await transactionModel.create({
        userId,
        username,
        Mobile,
        orderId: orderId || `ORD_${Date.now()}`,
        amount,
        status: 'INITIATED'
      })

      // Prepare payment payload
      const paymentPayload = {
        merchantId: "M23T8T3E76KMB",
        merchantTransactionId: transaction._id.toString(),
        merchantUserId: userId,
        amount: amount * 100, // Convert to paise
        redirectUrl: `https://madhusewingmachines.com/PaymentSuccess?transactionId=${transaction._id}&userID=${userId}`,


        callbackUrl: "https://madhusewingmachines.com/api/user/checkPayment/" + transaction._id + "/" + userId,

        mobileNumber: Mobile,
        paymentInstrument: {
          type: "PAY_PAGE"
        }
      };

      // Generate signature
      const base64Payload = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');
      const stringToHash = base64Payload + '/pg/v1/pay' + clientSecret;
      const sha256Hash = crypto.createHash('sha256').update(stringToHash).digest('hex')+'###' + 1;
      const signature = sha256Hash + '###' + clientSecret;

      res.status(200).json({
        success: true,
        data: {
          transactionBody: base64Payload,
          checksum: sha256Hash,
          transactionId: transaction._id,
        },
      });

    } catch (error) {
      console.error("Payment Error:", error.message);

      // Update transaction status if it was created
      if (transaction) {
        await transactionModel.findByIdAndUpdate(transaction._id, {
          status: 'FAILED',
          error: error.response?.data?.message || error.message
        });
      }

      return res.status(500).json({
        error: "Payment processing error",
        details: error.response?.data || error.message
      });
    }
  }

  async updateStatuspayment(req, res) {
    try {
      let id = req.params.id;
      let data = await transactionModel.findById(id);
      if (!data) return res.status(400).json({ error: "Data not found" });
      data.status = "Completed";
      data.save();
      return res.status(200).json({ success: "Successfully Completed" });
    } catch (error) {
      console.log(error);
    }
  }

  async checkPayment(req, res) {
    try {

      let id = req.params.id;
      let userId = req.params.userId
      let data = await transactionModel.findById(id);
      if (!data) return res.status(400).json({ error: "Payment Id not found!" })
      client.getOrderStatus(id).then(async (response) => {
        const state = response.state;
        if (state == "COMPLETED") {
          if (data.config) {
            await axios(JSON.parse(data.config))
            data.config = null
          }
        }
        data.status = state;
        data = await data.save()
        return res.status(200).json({ success: data })
      }).catch((error) => {
        return res.status(400).json({ error: error })
      });

    } catch (error) {
      console.log(error)
      return res.status(400).json({ error: error.message })
    }
  }

  async paymentcallback(req, res) {
    const { response } = req.body;

    const decodedStr = Buffer.from(response, 'base64').toString('utf-8');

    // Parse JSON
    const responseJson = JSON.parse(decodedStr);
    console.log(responseJson?.data);
    const { merchantTransactionId, state } = responseJson?.data;

    // Log the callback data for debugging
    console.log(`Callback received: Transaction ${merchantTransactionId}, Status: ${state}`);
    let data = await transactionModel.findById(merchantTransactionId);
    if (data) {
      data.status = state;
      if (state === 'COMPLETED') {
        await axios(JSON.parse(data.config))
      }
      await data.save()
    }
    // Update transaction status in your database
    if (state === 'COMPLETED') {


      // Mark the transaction as successful
      // Update relevant database records
      console.log(`Transaction ${merchantTransactionId} was successful.`);
    } else {
      // Handle failure or pending status
      console.log(`Transaction ${merchantTransactionId} failed or is pending.`);
    }

    // Send a response back to the payment gateway
    res.status(200).send('Callback processed');
  }

  async getallpayment(req, res) {
    try {
      let data = await transactionModel.find({}).sort({ _id: -1 });
      return res.status(200).json({ success: data });
    } catch (error) {
      console.log(error)
    }
  }

  async makepayment(req, res) {
    let {
      amount,
      merchantTransactionId,
      merchantUserId,
      redirectUrl,
      callbackUrl,
      mobileNumber,
    } = req.body;

    function generateSignature(payload, saltKey, saltIndex) {
      const encodedPayload = Buffer.from(payload).toString("base64");
      const concatenatedString = encodedPayload + "/pg/v1/pay" + saltKey;
      const hashedValue = crypto
        .createHash("sha256")
        .update(concatenatedString)
        .digest("hex");

      const signature = hashedValue + "###" + saltIndex;
      return signature;
    }

    const paymentDetails = {
      merchantId: MERCHANT_ID,
      merchantTransactionId: merchantTransactionId,
      merchantUserId: merchantUserId,
      amount: amount,
      redirectUrl: CALLBACK_URL,
      redirectMode: "POST",
      callbackUrl: callbackUrl,
      mobileNumber: mobileNumber,
      paymentInstrument: {
        type: "PAY_PAGE",
      },
    };

    const payload = JSON.stringify(paymentDetails);
    let objJsonB64 = Buffer.from(payload).toString("base64");
    const saltKey = SECRET_KEY; //test key
    const saltIndex = 1;
    const signature = generateSignature(payload, saltKey, saltIndex);

    try {
      const response = await axios.post(
        "https://api.phonepe.com/apis/hermes/pg/v1/pay",

        // "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay",
        {
          request: objJsonB64,
        },
        {
          headers: {
            "X-VERIFY": signature,
          },
        }
      );

      //   console.log(
      //     "Payment Response:",
      //     response.data,
      //     response.data?.data.instrumentResponse?.redirectInfo?.url
      //   );
      return res.status(200).json({
        url: response.data?.data.instrumentResponse?.redirectInfo,
      });
    } catch (error) {
      console.error("Payment Error:", error);
    }
  }

}

module.exports = new Transaction();

