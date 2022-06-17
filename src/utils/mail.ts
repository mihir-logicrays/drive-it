import mail from 'nodemailer';

const mailer = mail.createTransport({
  host: 'smtp.hostinger.in',
  port: 587, // SMTP PORT
  secure: false, // true for 465, false for other ports
  auth: {
    user: 'info@lrdevteam.com',
    pass: 'Lrdemo@123',
  },
});
export default mailer;
