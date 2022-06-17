import admin from 'firebase-admin';

const serviceAccount = {
};

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(JSON.stringify(serviceAccount))),
});

export default admin;
