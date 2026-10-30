const nodemailer = require("nodemailer");



function gmailUser() {

  return String(process.env.GMAIL_USER || "").trim();

}



function gmailPassword() {

  return String(process.env.GMAIL_PASSWORD || "").replace(/\s+/g, "");

}



function isConfigured() {

  return Boolean(gmailUser() && gmailPassword());

}



function transporter() {

  if (!isConfigured()) {

    throw new Error("Gmail is not configured. Add GMAIL_USER and GMAIL_PASSWORD to your .env file.");

  }



  const pass = gmailPassword();

  if (pass.length !== 16 || !/^[A-Za-z0-9]{16}$/.test(pass)) {

    throw new Error(

      "GMAIL_PASSWORD must be a 16-character Gmail App Password, not your normal Gmail password. In .env use quotes, for example GMAIL_PASSWORD=\"xxxx xxxx xxxx xxxx\". Create one at https://myaccount.google.com/apppasswords"

    );

  }



  return nodemailer.createTransport({

    host: "smtp.gmail.com",

    port: 465,

    secure: true,

    auth: {

      user: gmailUser(),

      pass,

    },

  });

}



function purposeCopy(purpose) {

  if (purpose === "login") {

    return {

      subject: "Your Cop A Cap sign-in code",

      intro: "Use this code to finish signing in.",

    };

  }

  if (purpose === "reset") {

    return {

      subject: "Your Cop A Cap password reset code",

      intro: "Use this code to confirm your password reset.",

    };

  }

  return {

    subject: "Your Cop A Cap verification code",

    intro: "Use this code to confirm your new account.",

  };

}



async function sendOtpEmail(to, otp, purpose = "register") {

  const { subject, intro } = purposeCopy(purpose);

  const from = gmailUser();

  await transporter().sendMail({

    from: `"Cop A Cap" <${from}>`,

    to,

    subject,

    text: `${intro}\n\nYour verification code is: ${otp}\n\nThis code expires in 5 minutes. If you did not request it, you can ignore this email.`,

    html: `

      <div style="font-family:Arial,sans-serif;background:#f5f5f5;padding:32px">

        <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #dddddd;border-radius:12px;padding:28px">

          <p style="margin:0 0 8px;letter-spacing:.14em;text-transform:uppercase;font-size:11px;color:#111111;font-weight:700">Cop A Cap</p>

          <h1 style="font-weight:700;font-size:26px;margin:0 0 12px;color:#000000">Verification code</h1>

          <p style="color:#444444;line-height:1.5">${intro}</p>

          <p style="letter-spacing:.28em;font-size:32px;font-weight:700;color:#000000;text-align:center;background:#f5f5f5;border:1px solid #111111;border-radius:8px;padding:16px;margin:24px 0">${otp}</p>

          <p style="color:#666666;font-size:13px">This code expires in 5 minutes. If you did not request it, you can ignore this email.</p>

        </div>

      </div>

    `,

  });

}



module.exports = { sendOtpEmail, isConfigured };


