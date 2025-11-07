const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

try {
  const serviceAccountPath = path.join(__dirname, '../madhu-sewing-machines-firebase-adminsdk-fbsvc-112b4a05a4.json');
  
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseInitialized = true;
      console.log('Firebase Admin SDK initialized successfully');
    } else {
      firebaseInitialized = true;
    }
  } else {
    console.warn('Firebase service account key not found. Push notifications will be disabled.');
    console.warn('Expected path:', serviceAccountPath);
  }
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error.message);
  console.warn('Push notifications will be disabled.');
}

/**
 * Send push notification to a technician
 * @param {String} fcmToken - FCM token of the technician
 * @param {String} title - Notification title
 * @param {String} body - Notification body
 * @param {Object} data - Additional data payload
 */
const sendNotification = async (fcmToken, title, body, data = {}) => {
  if (!firebaseInitialized) {
    console.log('Firebase not initialized. Notification not sent.');
    return { success: false, error: 'Firebase not initialized' };
  }

  if (!fcmToken) {
    console.log('No FCM token provided');
    return { success: false, error: 'No FCM token' };
  }

  const message = {
    notification: {
      title: title,
      body: body,
    },
    data: {
      ...data,
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    },
    token: fcmToken,
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'default',
      },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Successfully sent notification:', response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Error sending notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification when a job is assigned to a technician
 * @param {String} fcmToken - FCM token of the technician
 * @param {Object} jobData - Job information
 */
const sendJobAssignedNotification = async (fcmToken, jobData) => {
  const title = 'New Job Assigned';
  const body = `You have been assigned a new service request. Customer: ${jobData.customerName || 'Customer'}`;
  
  const data = {
    type: 'job_assigned',
    jobId: jobData.jobId || '',
    customerName: jobData.customerName || '',
    serviceType: jobData.serviceType || '',
  };

  return await sendNotification(fcmToken, title, body, data);
};

module.exports = {
  sendNotification,
  sendJobAssignedNotification,
};

