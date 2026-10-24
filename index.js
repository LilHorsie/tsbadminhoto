require('dotenv').config();
const express = require('express');
const formsg = require('@opengovsg/formsg-sdk')();
const axios = require('axios');

const app = express();
app.use(express.json());

const {
  PORT,
  WEBHOOK_URI,
  FORMSG_SECRET_KEY,
  TELEGRAM_TOKEN,
  TELEGRAM_CHAT_ID
} = process.env;

app.post('/webhook', (req, res) => {
  try {
    // 1. Authenticate the FormSG webhook signature
    const signature = req.get('X-FormSG-Signature');
    if (!signature) throw new Error("Missing signature");
    
    formsg.webhooks.authenticate(signature, WEBHOOK_URI);

    // 2. Decrypt the response
    const decryptedData = formsg.crypto.decrypt(
      FORMSG_SECRET_KEY,
      req.body.data
    );

    // 3. Format the message for Telegram
    let message = "📝 *New FormSG Submission*\n\n";
    
    if (decryptedData && decryptedData.responses) {
      decryptedData.responses.forEach(response => {
        // Handle different question types (text, arrays, etc.)
        const answer = Array.isArray(response.answerArray) 
          ? response.answerArray.join(', ') 
          : response.answer;
          
        message += `*${response.question}*: ${answer || 'N/A'}\n`;
      });
    }

    // 4. Send the notification to Telegram
    axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'Markdown'
    }).catch(err => console.error("Telegram API Error:", err.message));

    // FormSG requires a 200 OK response to know the webhook succeeded
    res.status(200).send('Success');

  } catch (error) {
    console.error('Webhook Error:', error.message);
    res.status(401).send('Unauthorized or Decryption Failed');
  }
});

module.exports = app;