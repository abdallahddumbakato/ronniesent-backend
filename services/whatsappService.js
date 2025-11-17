// Generate WhatsApp message links
export const generateWhatsAppLink = (phone, message) => {
  // Remove leading 0 and add Uganda country code
  const formattedPhone = phone.replace(/^0/, '256');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
};

// Send welcome message via WhatsApp link
export const sendWelcomeWhatsApp = (phone, fullName, email, password) => {
  const message = `🎬 Welcome to Ronnie's Entertainment, ${fullName}!

Your account has been created successfully!

📧 Email: ${email}
🔑 Password: ${password}

You can now login and start enjoying thousands of movies.

Login here: https://www.ronniesent.com/login

Thank you for joining Ronnie's Entertainment! 🎉`;

  const whatsappLink = generateWhatsAppLink(phone, message);
  return whatsappLink;
};

// Send password reset via WhatsApp
export const sendPasswordResetWhatsApp = (phone, fullName, otp) => {
  const message = `🔐 Ronnie's Entertainment Password Reset

Hello ${fullName},

Your password reset code is: ${otp}

This code will expire in 10 minutes.

If you didn't request this reset, please ignore this message.`;

  const whatsappLink = generateWhatsAppLink(phone, message);
  return whatsappLink;
};
